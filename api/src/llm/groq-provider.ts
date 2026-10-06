import { z } from "zod";

import type { LlmConfig } from "./config.js";
import { LlmError } from "./errors.js";
import { postJson } from "./http.js";
import type { JsonValue, LlmMessage, LlmProvider, LlmRequest, LlmResponse } from "./types.js";

const responseSchema = z.object({
  choices: z.array(z.object({
    finish_reason: z.string().nullable().optional(),
    message: z.object({
      content: z.string().nullable().optional(),
      tool_calls: z.array(z.object({
        id: z.string(),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      })).optional(),
    }),
  })).min(1),
  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
  }).optional(),
});

function toGroqMessage(message: LlmMessage) {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: JSON.stringify(message.result),
    };
  }

  if (message.toolCalls) {
    return {
      role: "assistant",
      content: message.content ?? null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments),
        },
      })),
    };
  }

  return { role: message.role, content: message.content };
}

function parseToolArguments(value: string): Record<string, JsonValue> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Tool arguments must be an object");
    }
    return parsed as Record<string, JsonValue>;
  } catch {
    throw new LlmError("LLM_INVALID_RESPONSE", "Groq returned invalid tool arguments");
  }
}

export class GroqProvider implements LlmProvider {
  constructor(
    private readonly config: LlmConfig,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const body = {
      model: this.config.model,
      messages: [
        ...(request.systemPrompt
          ? [{ role: "system", content: request.systemPrompt }]
          : []),
        ...request.messages.map(toGroqMessage),
      ],
      max_completion_tokens: request.maxTokens ?? this.config.maxTokens,
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.tools?.length
        ? {
            tools: request.tools.map((tool) => ({
              type: "function",
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
              },
            })),
            tool_choice: "auto",
          }
        : {}),
    };

    const raw = await postJson(
      this.fetchImplementation,
      "https://api.groq.com/openai/v1/chat/completions",
      { authorization: `Bearer ${this.config.apiKey}` },
      body,
      this.config.timeoutMs,
    );
    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new LlmError("LLM_INVALID_RESPONSE", "Groq returned an invalid response");
    }

    const choice = parsed.data.choices[0];
    return {
      provider: "groq",
      model: this.config.model,
      text: choice.message.content ?? "",
      toolCalls: (choice.message.tool_calls ?? []).map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: parseToolArguments(call.function.arguments),
      })),
      finishReason: choice.finish_reason ?? undefined,
      usage: {
        inputTokens: parsed.data.usage?.prompt_tokens,
        outputTokens: parsed.data.usage?.completion_tokens,
      },
    };
  }
}
