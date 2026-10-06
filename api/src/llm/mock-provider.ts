import type { LlmProvider, LlmRequest, LlmResponse } from "./types.js";

export class MockLlmProvider implements LlmProvider {
  constructor(private readonly model = "deterministic-mock-v1") {}

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const latestUserMessage = [...request.messages]
      .reverse()
      .find((message) => message.role === "user");
    const content = latestUserMessage && "content" in latestUserMessage
      ? latestUserMessage.content
      : "";

    return {
      provider: "mock",
      model: this.model,
      text: `Mock response: ${content}`,
      toolCalls: [],
      finishReason: "stop",
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
