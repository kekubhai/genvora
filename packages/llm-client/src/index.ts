// LLM Client — thin abstraction over OpenAI / Anthropic / Gemini / Perplexity
// Phase 0 skeleton: types and provider interface only.
// Implementations will be added in later phases.

export type LLMProvider = "openai" | "anthropic" | "gemini" | "perplexity";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionOptions {
  provider: LLMProvider;
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMCompletionResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function complete(_options: LLMCompletionOptions): Promise<LLMCompletionResult> {
  // TODO: implement in Phase 1+
  throw new Error("LLM client not yet implemented");
}
