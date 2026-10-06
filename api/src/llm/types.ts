export type JsonValue = string | number | boolean | null | JsonValue[] | {
  [key: string]: JsonValue;
};

export type LlmToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, JsonValue>;
};

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: Record<string, JsonValue>;
};

export type LlmMessage =
  | { role: "user" | "assistant"; content: string; toolCalls?: never }
  | { role: "assistant"; content?: string; toolCalls: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; toolName: string; result: JsonValue };

export type LlmRequest = {
  systemPrompt?: string;
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  temperature?: number;
  maxTokens?: number;
};

export type LlmResponse = {
  provider: "groq" | "mock";
  model: string;
  text: string;
  toolCalls: LlmToolCall[];
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export interface LlmProvider {
  generate(request: LlmRequest): Promise<LlmResponse>;
}
