import { LlmError } from "./errors.js";

export async function postJson(
  fetchImplementation: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  try {
    const response = await fetchImplementation(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new LlmError(
        "LLM_PROVIDER_ERROR",
        `LLM provider returned ${response.status}: ${detail}`,
        response.status,
      );
    }
    return response.json();
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new LlmError("LLM_TIMEOUT", "LLM request timed out");
    }
    throw new LlmError(
      "LLM_PROVIDER_ERROR",
      error instanceof Error ? error.message : "LLM request failed",
    );
  }
}
