import { z } from "zod";

import { LlmError } from "./errors.js";

const envSchema = z.object({
  LLM_PROVIDER: z.enum(["groq", "mock"]).default("mock"),
  LLM_MODEL: z.string().trim().min(1).optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  LLM_MAX_TOKENS: z.coerce.number().int().min(1).max(8192).default(2048),
  GROQ_API_KEY: z.string().trim().min(1).optional(),
});

export type LlmConfig = {
  provider: "groq" | "mock";
  model: string;
  timeoutMs: number;
  maxTokens: number;
  apiKey?: string;
};

export function loadLlmConfig(environment: NodeJS.ProcessEnv = process.env): LlmConfig {
  const parsed = envSchema.safeParse(environment);
  if (!parsed.success) {
    throw new LlmError("LLM_CONFIGURATION_ERROR", "Invalid LLM configuration");
  }

  const env = parsed.data;
  if (env.LLM_PROVIDER === "groq" && !env.GROQ_API_KEY) {
    throw new LlmError("LLM_CONFIGURATION_ERROR", "GROQ_API_KEY is required");
  }

  const defaultModels = {
    groq: "openai/gpt-oss-20b",
    mock: "deterministic-mock-v1",
  } as const;

  return {
    provider: env.LLM_PROVIDER,
    model: env.LLM_MODEL ?? defaultModels[env.LLM_PROVIDER],
    timeoutMs: env.LLM_TIMEOUT_MS,
    maxTokens: env.LLM_MAX_TOKENS,
    apiKey: env.LLM_PROVIDER === "groq" ? env.GROQ_API_KEY : undefined,
  };
}
