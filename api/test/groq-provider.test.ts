import assert from "node:assert/strict";
import test from "node:test";

import type { LlmConfig } from "../src/llm/config.js";
import { LlmError } from "../src/llm/errors.js";
import { GroqProvider } from "../src/llm/groq-provider.js";

const config: LlmConfig = {
  provider: "groq",
  model: "openai/gpt-oss-20b",
  timeoutMs: 5000,
  maxTokens: 512,
  apiKey: "test-key",
};

test("Groq text and tool calls are normalized", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const fakeFetch: typeof fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      choices: [{
        finish_reason: "tool_calls",
        message: {
          content: "I will check that request.",
          tool_calls: [{
            id: "call-1",
            function: {
              name: "get_request",
              arguments: JSON.stringify({ requestId: "req-1" }),
            },
          }],
        },
      }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const provider = new GroqProvider(config, fakeFetch);
  const response = await provider.generate({
    systemPrompt: "Help with move requests.",
    messages: [{ role: "user", content: "Check my request" }],
    tools: [{
      name: "get_request",
      description: "Get a request",
      inputSchema: {
        type: "object",
        properties: { requestId: { type: "string" } },
        required: ["requestId"],
      },
    }],
  });

  assert.ok(requestBody?.messages);
  assert.ok(requestBody?.tools);
  assert.equal(response.provider, "groq");
  assert.equal(response.text, "I will check that request.");
  assert.deepEqual(response.toolCalls[0], {
    id: "call-1",
    name: "get_request",
    arguments: { requestId: "req-1" },
  });
});

test("invalid Groq tool arguments are rejected", async () => {
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content: null,
        tool_calls: [{
          id: "call-1",
          function: { name: "get_request", arguments: "not-json" },
        }],
      },
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });

  await assert.rejects(
    new GroqProvider(config, fakeFetch).generate({
      messages: [{ role: "user", content: "Check my request" }],
    }),
    (error) => error instanceof LlmError && error.code === "LLM_INVALID_RESPONSE",
  );
});

test("temporary Groq failures are retried once", async () => {
  let attempts = 0;
  const fakeFetch: typeof fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      return new Response(JSON.stringify({ error: "temporarily unavailable" }), {
        status: 503,
      });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: "Recovered." } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const response = await new GroqProvider(config, fakeFetch).generate({
    messages: [{ role: "user", content: "Try again" }],
  });

  assert.equal(attempts, 2);
  assert.equal(response.text, "Recovered.");
});
