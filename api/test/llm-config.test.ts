import assert from "node:assert/strict";
import test from "node:test";

import { loadLlmConfig } from "../src/llm/config.js";
import { LlmError } from "../src/llm/errors.js";
import { createLlmProvider } from "../src/llm/factory.js";

test("mock provider is the safe default", async () => {
  const config = loadLlmConfig({});
  const provider = createLlmProvider(config);
  const response = await provider.generate({
    messages: [{ role: "user", content: "hello" }],
  });
  assert.equal(response.provider, "mock");
  assert.equal(response.text, "Mock response: hello");
});

test("Groq configuration requires an API key", () => {
  assert.throws(
    () => loadLlmConfig({ LLM_PROVIDER: "groq" }),
    (error) => error instanceof LlmError && error.code === "LLM_CONFIGURATION_ERROR",
  );
});

test("Groq configuration selects the configured model", () => {
  const config = loadLlmConfig({
    LLM_PROVIDER: "groq",
    LLM_MODEL: "custom-groq-model",
    GROQ_API_KEY: "test-key",
  });
  assert.equal(config.provider, "groq");
  assert.equal(config.model, "custom-groq-model");
  assert.equal(config.apiKey, "test-key");
});
