import { DomainError, isDomainError } from "../domain/errors.js";
import type { Prisma, UserRole } from "../generated/prisma/client.js";
import type { JsonValue, LlmMessage, LlmProvider, LlmToolCall } from "../llm/types.js";
import { ConversationContextService } from "../services/conversation-context.js";
import { ConversationService } from "../services/conversations.js";
import { getConfirmedAction } from "./confirmation.js";
import { buildAgentPrompt } from "./prompt.js";
import { executeTool, getToolDefinitions } from "./tools.js";

type Actor = { userId: string; communityId: string; role: UserRole };

export class AgentOrchestrator {
  constructor(
    private readonly provider: LlmProvider,
    private readonly maxIterations = 5,
  ) {}

  async respond(actor: Actor, conversationId: string, content: string) {
    await ConversationService.addUserMessage(actor, conversationId, content);
    const context = await ConversationContextService.load({ conversationId, ...actor });
    const messages = context.messages.flatMap(toLlmMessage);
    const tools = getToolDefinitions(actor.role);
    const confirmedAction = getConfirmedAction(content);
    let linkedRequestId = context.conversation.requestId;

    for (let iteration = 0; iteration < this.maxIterations; iteration += 1) {
      const response = await this.provider.generate({
        systemPrompt: buildAgentPrompt(actor.role, {
          actor: context.actor,
          request: context.request,
          policy: context.policy,
        }),
        messages,
        tools,
        temperature: 0.2,
        maxTokens: 700,
      });

      if (response.toolCalls.length === 0) {
        const text = response.text.trim() || "I could not complete that request. Please try again.";
        const message = await ConversationService.appendAgentMessage(
          actor,
          conversationId,
          "ASSISTANT",
          text,
          { provider: response.provider, model: response.model, usage: response.usage } as Prisma.InputJsonValue,
        );
        return { message, requestId: linkedRequestId };
      }

      await ConversationService.appendAgentMessage(
        actor,
        conversationId,
        "ASSISTANT",
        response.text,
        { toolCalls: response.toolCalls } as Prisma.InputJsonValue,
      );
      messages.push({ role: "assistant", content: response.text, toolCalls: response.toolCalls });

      for (const call of response.toolCalls) {
        let result: JsonValue;
        try {
          result = await executeTool(call, {
            actor,
            conversationId,
            requestId: linkedRequestId,
            confirmedAction,
          });
          if (call.name === "create_move_request" && isJsonObject(result) && typeof result.id === "string") {
            linkedRequestId = result.id;
          }
        } catch (error) {
          if (!isDomainError(error)) throw error;
          result = { ok: false, error: error.code, details: toJsonValue(error.details ?? {}) };
        }

        await ConversationService.appendAgentMessage(
          actor,
          conversationId,
          "TOOL",
          JSON.stringify(result),
          {
            toolCallId: call.id,
            toolName: call.name,
            result,
          } as Prisma.InputJsonValue,
        );
        messages.push({ role: "tool", toolCallId: call.id, toolName: call.name, result });
      }
    }

    throw new DomainError("AGENT_ITERATION_LIMIT");
  }
}

function toLlmMessage(message: {
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  metadata: Prisma.JsonValue | null;
}): LlmMessage[] {
  if (message.role === "USER") return [{ role: "user", content: message.content }];
  if (message.role === "SYSTEM") return [];

  if (message.role === "TOOL" && isJsonObject(message.metadata)) {
    const { toolCallId, toolName, result } = message.metadata;
    if (typeof toolCallId === "string" && typeof toolName === "string") {
      return [{
        role: "tool",
        toolCallId,
        toolName,
        result: toJsonValue(result),
      }];
    }
    return [];
  }

  if (message.role === "ASSISTANT" && isJsonObject(message.metadata)) {
    const calls = parseToolCalls(message.metadata.toolCalls);
    if (calls.length) return [{ role: "assistant", content: message.content, toolCalls: calls }];
  }
  return [{ role: "assistant", content: message.content }];
}

function parseToolCalls(value: unknown): LlmToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isJsonObject(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
    if (!isJsonObject(item.arguments)) return [];
    return [{
      id: item.id,
      name: item.name,
      arguments: item.arguments as Record<string, JsonValue>,
    }];
  });
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as JsonValue;
}
