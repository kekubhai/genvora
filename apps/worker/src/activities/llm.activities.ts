// LLM-powered audit summarization activity
// Wraps every step in a named OTel span so the trace shows the full
// "agent reasoning" pipeline: prompt construction → API call → response parse.

import { trace, SpanStatusCode } from "@opentelemetry/api";
import { complete, resolveDefaultConfig } from "@repo/llm-client";
import type { LLMSummaryInput, LLMSummaryResult } from "@repo/shared-types";

const tracer = trace.getTracer("genvora-worker");

// =============================================================================
// Prompt template
// =============================================================================

function buildPrompt(input: LLMSummaryInput): string {
  const findings: string[] = [];

  // Structure findings
  if (!input.structure.hasSchemaOrg) {
    findings.push("- No Schema.org/JSON-LD structured data found");
  }
  if (input.structure.altTextCoverage < 0.8) {
    findings.push(`- Only ${Math.round(input.structure.altTextCoverage * 100)}% of images have alt text`);
  }
  if (input.structure.semanticHtmlRatio < 0.3) {
    findings.push(`- Low semantic HTML ratio (${Math.round(input.structure.semanticHtmlRatio * 100)}%)`);
  }

  // Crawlability findings
  if (!input.crawlability.robotsTxtAllowsAi) {
    findings.push("- robots.txt blocks AI crawlers");
  }
  if (!input.crawlability.hasLlmsTxt) {
    findings.push("- No llms.txt file present");
  }
  if (input.crawlability.requiresJsRendering) {
    findings.push("- Content requires JavaScript rendering (AI bots may not see it)");
  }

  // Accessibility findings
  if (input.accessibility.missingAltText > 0) {
    findings.push(`- ${input.accessibility.missingAltText} images missing alt text`);
  }
  if (!input.accessibility.formLabelsPresent) {
    findings.push("- Form inputs lack proper labels");
  }

  // Semantic findings
  if (!input.semantic.mainContentIdentified) {
    findings.push("- Main content area not identified (<main> tag missing)");
  }
  if (!input.semantic.hasSemanticTags) {
    findings.push("- No semantic HTML tags used (<article>, <nav>, <section>, etc.)");
  }

  // Structured data findings
  if (!input.structuredData.hasJsonLd) {
    findings.push("- No JSON-LD structured data");
  }

  const scoreBreakdown = Object.entries(input.categoryScores)
    .map(([cat, score]) => `${cat}: ${score}`)
    .join(", ");

  return `You are an AI readiness auditor. Analyze this website audit and produce a concise executive summary.

URL: ${input.url}
Overall Score: ${input.overallScore}/100
Category Scores: ${scoreBreakdown}

Key findings from the automated scan:
${findings.length > 0 ? findings.join("\n") : "- No major issues detected"}

Generate a JSON response with exactly these fields:
{
  "executive_summary": "2-3 sentence overview for a non-technical stakeholder",
  "key_findings": ["array of 3-5 most important findings, each as a single sentence"],
  "priority_actions": ["array of 3-5 specific, actionable steps ordered by impact"],
  "estimated_impact": "1 sentence estimating the score improvement from implementing priority actions"
}

Respond ONLY with valid JSON. No markdown fences.`;
}

// =============================================================================
// Activity — instrumented with per-step spans
// =============================================================================

export async function llmSummarizeActivity(
  input: LLMSummaryInput,
): Promise<LLMSummaryResult> {
  return tracer.startActiveSpan("activity.llm_summarize", async (span) => {
    span.setAttribute("activity.name", "llmSummarizeActivity");
    span.setAttribute("llm.target_url", input.url);
    span.setAttribute("llm.input_overall_score", input.overallScore);

    const config = resolveDefaultConfig();
    span.setAttribute("llm.provider", config?.provider ?? "unknown");
    span.setAttribute("llm.model", config?.model ?? "unknown");

    // --- Step 1: Build prompt ---
    const findingsCount =
      (input.structure.hasSchemaOrg ? 0 : 1) +
      (input.structure.altTextCoverage < 0.8 ? 1 : 0) +
      (input.crawlability.robotsTxtAllowsAi ? 0 : 1) +
      (input.crawlability.hasLlmsTxt ? 0 : 1) +
      (input.accessibility.missingAltText > 0 ? 1 : 0) +
      (input.semantic.hasSemanticTags ? 0 : 1) +
      (input.structuredData.hasJsonLd ? 0 : 1);

    const prompt = buildPrompt(input);

    await tracer.startActiveSpan("llm.build_prompt", (promptSpan) => {
      promptSpan.setAttribute("prompt.findings_count", findingsCount);
      promptSpan.setAttribute("prompt.char_count", prompt.length);
      promptSpan.setAttribute("prompt.token_estimate", Math.ceil(prompt.length / 4));
      promptSpan.end();
    });

    // --- Step 2: Call LLM ---
    const llmResult = await tracer.startActiveSpan("llm.call", async (callSpan) => {
      try {
        const result = await complete({
          provider: config?.provider ?? "openai",
          model: config?.model ?? "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          maxTokens: 2048,
        });

        callSpan.setAttribute("llm.latency_ms", result.latencyMs);
        callSpan.setAttribute("llm.output_chars", result.content.length);
        if (result.usage) {
          callSpan.setAttribute("llm.tokens.prompt", result.usage.promptTokens);
          callSpan.setAttribute("llm.tokens.completion", result.usage.completionTokens);
          callSpan.setAttribute("llm.tokens.total", result.usage.totalTokens);
        }
        callSpan.end();
        return result;
      } catch (err) {
        callSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        callSpan.setAttribute("llm.error", true);
        callSpan.end();
        throw err;
      }
    });

    // --- Step 3: Parse response ---
    const parsed = await tracer.startActiveSpan("llm.parse_response", async (parseSpan) => {
      try {
        // Strip markdown fences if present
        let raw = llmResult.content.trim();
        if (raw.startsWith("```")) {
          raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        const data = JSON.parse(raw);
        parseSpan.setAttribute("parse.success", true);
        parseSpan.setAttribute("parse.fields_found", Object.keys(data).length);
        parseSpan.setAttribute("parse.key_findings_count", data.key_findings?.length ?? 0);
        parseSpan.setAttribute("parse.priority_actions_count", data.priority_actions?.length ?? 0);
        parseSpan.end();
        return data;
      } catch (err) {
        parseSpan.setAttribute("parse.success", false);
        parseSpan.setAttribute("parse.error", err instanceof Error ? err.message : String(err));
        parseSpan.setAttribute("parse.raw_length", llmResult.content.length);
        parseSpan.end();

        // Fallback: return raw content as executive summary
        return {
          executive_summary: llmResult.content,
          key_findings: [],
          priority_actions: [],
          estimated_impact: "Unable to parse structured response.",
        };
      }
    });

    // --- Step 4: Assemble result ---
    const result: LLMSummaryResult = {
      executiveSummary: parsed.executive_summary ?? "No summary generated.",
      keyFindings: Array.isArray(parsed.key_findings) ? parsed.key_findings : [],
      priorityActions: Array.isArray(parsed.priority_actions) ? parsed.priority_actions : [],
      estimatedImpact: parsed.estimated_impact ?? "Unknown.",
      tokensUsed: llmResult.usage?.totalTokens ?? 0,
      model: llmResult.model,
    };

    // Final span attributes
    span.setAttribute("llm.tokens_used", result.tokensUsed);
    span.setAttribute("llm.key_findings_count", result.keyFindings.length);
    span.setAttribute("llm.priority_actions_count", result.priorityActions.length);
    span.setAttribute("llm.parsed_successfully", result.keyFindings.length > 0);

    span.end();
    return result;
  });
}
