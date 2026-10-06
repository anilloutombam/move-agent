import type { LlmConfig } from "./config.js";
import { GroqProvider } from "./groq-provider.js";
import { MockLlmProvider } from "./mock-provider.js";
import type { LlmProvider } from "./types.js";

export function createLlmProvider(
  config: LlmConfig,
  fetchImplementation: typeof fetch = fetch,
): LlmProvider {
  switch (config.provider) {
    case "groq":
      return new GroqProvider(config, fetchImplementation);
    case "mock":
      return new MockLlmProvider(config.model);
  }
}
