export type LlmErrorCode =
  | "LLM_CONFIGURATION_ERROR"
  | "LLM_INVALID_RESPONSE"
  | "LLM_PROVIDER_ERROR"
  | "LLM_TIMEOUT";

export class LlmError extends Error {
  constructor(
    public readonly code: LlmErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
