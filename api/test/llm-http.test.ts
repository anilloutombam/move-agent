import assert from "node:assert/strict";
import test from "node:test";

import { LlmError } from "../src/llm/errors.js";
import { postJson } from "../src/llm/http.js";

test("provider HTTP errors are normalized", async () => {
  const fakeFetch: typeof fetch = async () => new Response(
    JSON.stringify({ error: "rate limited" }),
    { status: 429 },
  );

  await assert.rejects(
    postJson(fakeFetch, "https://example.test", {}, {}, 1000),
    (error) => error instanceof LlmError &&
      error.code === "LLM_PROVIDER_ERROR" &&
      error.status === 429,
  );
});

test("timeouts are normalized", async () => {
  const fakeFetch: typeof fetch = async () => {
    throw new DOMException("timed out", "TimeoutError");
  };

  await assert.rejects(
    postJson(fakeFetch, "https://example.test", {}, {}, 1000),
    (error) => error instanceof LlmError && error.code === "LLM_TIMEOUT",
  );
});
