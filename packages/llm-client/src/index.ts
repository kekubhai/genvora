// LLM Client — thin abstraction over OpenAI-compatible APIs
// Every API call is wrapped in an OTel span with tokens, latency, model, provider.

import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("genvora-llm");

// =============================================================================
// Types
// =============================================================================

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

export interface LLMTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMCompletionResult {
  content: string;
  usage?: LLMTokenUsage;
  model: string;
  provider: LLMProvider;
  latencyMs: number;
}

// =============================================================================
// Provider endpoint mapping (OpenAI-compatible)
// =============================================================================

const PROVIDER_ENDPOINTS: Record<LLMProvider, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  perplexity: "https://api.perplexity.ai/chat/completions",
};

const PROVIDER_ENV_KEYS: Record<LLMProvider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

// =============================================================================
// Mock mode — returns a deterministic response when no API key is set
// =============================================================================

function mockComplete(options: LLMCompletionOptions): LLMCompletionResult {
  // Extract the site URL from the last user message for a realistic mock
  const lastUserMsg = options.messages.filter((m) => m.role === "user").pop();
  const urlMatch = lastUserMsg?.content.match(/URL:\s*(https?:\/\/[^\s\n]+)/i);
  const url = urlMatch?.[1] ?? "https://example.com";

  return {
    content: JSON.stringify({
      executive_summary: `AI readiness audit for ${url} completed. The site has moderate AI visibility with several areas for improvement.`,
      key_findings: [
        "Schema.org markup is missing — AI systems cannot parse structured content",
        "robots.txt does not explicitly allow AI crawlers",
        "No llms.txt file to guide AI understanding",
        "Semantic HTML usage is below average",
      ],
      priority_actions: [
        "Add JSON-LD structured data for key page types",
        "Update robots.txt to explicitly allow GPTBot, ClaudeBot, and PerplexityBot",
        "Create an llms.txt with site description and key content URLs",
        "Replace div-based layouts with semantic HTML5 elements",
      ],
      estimated_impact: "Implementing these changes could improve AI readiness score by 25-35 points.",
    }),
    usage: { promptTokens: 847, completionTokens: 203, totalTokens: 1050 },
    model: "mock-gpt-4o",
    provider: options.provider,
    latencyMs: 0,
  };
}

// =============================================================================
// Real API call — OpenAI-compatible
// =============================================================================

async function callOpenAICompatible(
  options: LLMCompletionOptions,
  apiKey: string,
): Promise<LLMCompletionResult> {
  const endpoint = PROVIDER_ENDPOINTS[options.provider];
  const body = JSON.stringify({
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 2048,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // Anthropic uses a different header format
  if (options.provider === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    delete headers["Authorization"];
  }

  const startTime = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const latencyMs = Date.now() - startTime;

  // Parse response — OpenAI format (also used by Gemini, Perplexity)
  let content: string;
  let usage: LLMTokenUsage | undefined;

  if (options.provider === "anthropic") {
    const anthropicData = data as Record<string, unknown>;
    const contentBlocks = anthropicData.content as Array<Record<string, unknown>> | undefined;
    content = (contentBlocks?.[0]?.text as string) ?? "";
    const raw = anthropicData.usage as Record<string, number> | undefined;
    usage = raw
      ? {
          promptTokens: raw.input_tokens ?? 0,
          completionTokens: raw.output_tokens ?? 0,
          totalTokens: (raw.input_tokens ?? 0) + (raw.output_tokens ?? 0),
        }
      : undefined;
  } else {
    // OpenAI-compatible format
    const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
    content = choices?.[0]?.message?.content ?? "";
    const raw = data.usage as Record<string, number> | undefined;
    usage = raw
      ? {
          promptTokens: raw.prompt_tokens ?? 0,
          completionTokens: raw.completion_tokens ?? 0,
          totalTokens: raw.total_tokens ?? 0,
        }
      : undefined;
  }

  return {
    content,
    usage,
    model: options.model,
    provider: options.provider,
    latencyMs,
  };
}

// =============================================================================
// Public API — instrumented with OTel spans
// =============================================================================

/**
 * Complete a chat with an LLM. Every call is traced with a span containing:
 * - llm.provider, llm.model, llm.latency_ms
 * - llm.tokens.prompt, llm.tokens.completion, llm.tokens.total
 * - llm.input_tokens_per_message, llm.output_chars
 */
export async function complete(
  options: LLMCompletionOptions,
): Promise<LLMCompletionResult> {
  return tracer.startActiveSpan("llm.api_call", async (span) => {
    span.setAttribute("llm.provider", options.provider);
    span.setAttribute("llm.model", options.model);
    span.setAttribute("llm.temperature", options.temperature ?? 0.3);
    span.setAttribute("llm.max_tokens", options.maxTokens ?? 2048);
    span.setAttribute("llm.message_count", options.messages.length);

    // Per-message token estimates (rough: 4 chars ≈ 1 token)
    const totalChars = options.messages.reduce((sum, m) => sum + m.content.length, 0);
    span.setAttribute("llm.input_chars", totalChars);
    span.setAttribute("llm.input_tokens_estimate", Math.ceil(totalChars / 4));

    // Check for API key
    const envKey = PROVIDER_ENV_KEYS[options.provider];
    const apiKey = process.env[envKey];

    let result: LLMCompletionResult;

    try {
      if (!apiKey || apiKey.trim() === "") {
        span.setAttribute("llm.mode", "mock");
        result = mockComplete(options);
      } else {
        span.setAttribute("llm.mode", "live");
        result = await callOpenAICompatible(options, apiKey);
      }
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      span.setAttribute("llm.error", true);
      span.setAttribute("llm.error_message", err instanceof Error ? err.message : String(err));
      span.end();
      throw err;
    }

    // Enrich span with result data
    span.setAttribute("llm.latency_ms", result.latencyMs);
    span.setAttribute("llm.output_chars", result.content.length);
    if (result.usage) {
      span.setAttribute("llm.tokens.prompt", result.usage.promptTokens);
      span.setAttribute("llm.tokens.completion", result.usage.completionTokens);
      span.setAttribute("llm.tokens.total", result.usage.totalTokens);
    }

    span.end();
    return result;
  });
}

/**
 * Resolve the default provider and model from environment variables.
 * Returns null if no provider is configured.
 */
export function resolveDefaultConfig(): { provider: LLMProvider; model: string } | null {
  const provider = (process.env["LLM_PROVIDER"] as LLMProvider) ?? "openai";
  const model = process.env["LLM_MODEL"] ?? "gpt-4o-mini";

  // Check if any API key is set for this provider
  const envKey = PROVIDER_ENV_KEYS[provider];
  if (process.env[envKey]) {
    return { provider, model };
  }

  // Even without a key, return the config (mock mode will be used)
  return { provider, model };
}
