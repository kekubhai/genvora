import type { CategoryType, ScanStatus, Severity } from "@repo/shared-types";
import { apiPath } from "./api";

export type SiteSummary = {
  id: string;
  domain: string;
  createdAt: string;
  _count?: { scans: number };
  scans?: Array<{
    id: string;
    status: ScanStatus;
    overallScore: number | null;
    createdAt: string;
    completedAt: string | null;
  }>;
};

export type CategoryScoreDto = {
  id: string;
  scanId: string;
  category: CategoryType | string;
  score: number;
  details: Record<string, unknown>;
};

export type RecommendationDto = {
  id: string;
  scanId: string;
  severity: Severity | string;
  title: string;
  description: string;
  fixSnippet?: string | null;
};

export type ScanDto = {
  id: string;
  siteId: string;
  status: ScanStatus | string;
  overallScore: number | null;
  rawHtmlUrl?: string | null;
  screenshotUrl?: string | null;
  createdAt: string;
  completedAt?: string | null;
  categoryScores: CategoryScoreDto[];
  recommendations: RecommendationDto[];
  site?: { id: string; domain: string };
};

/** Pipeline stages matching worker OTel span names (`activity.*`). */
export const AUDIT_PIPELINE = [
  { id: "fetch_page", span: "activity.fetch_page", label: "Fetch page", detail: "Playwright + bot UAs" },
  { id: "parse_structure", span: "activity.parse_structure", label: "Parse structure", detail: "Headings, links, schema" },
  { id: "check_crawlability", span: "activity.check_crawlability", label: "Crawlability", detail: "robots.txt / llms.txt" },
  { id: "analyze_accessibility", span: "activity.analyze_accessibility", label: "Accessibility", detail: "Alt text & ARIA" },
  { id: "analyze_semantic", span: "activity.analyze_semantic", label: "Semantics", detail: "Landmarks & tags" },
  { id: "analyze_structured_data", span: "activity.analyze_structured_data", label: "Structured data", detail: "JSON-LD validity" },
  { id: "score", span: "activity.score", label: "Score", detail: "Category rollup" },
  { id: "generate_recommendations", span: "activity.generate_recommendations", label: "Recommendations", detail: "Severity-ranked fixes" },
  { id: "store_snapshot", span: "activity.store_snapshot", label: "Store snapshot", detail: "HTML + screenshot" },
  { id: "llm_summarize", span: "activity.llm_summarize", label: "LLM summary", detail: "Agent reasoning spans" },
] as const;

export function normalizeScanUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function upsertSite(domainOrUrl: string): Promise<SiteSummary> {
  const response = await fetch(apiPath("/sites"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain: domainOrUrl }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Failed to create site (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  return response.json() as Promise<SiteSummary>;
}

export async function listSites(): Promise<SiteSummary[]> {
  const response = await fetch(apiPath("/sites"));
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Failed to list sites (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  return response.json() as Promise<SiteSummary[]>;
}

export async function createScan(siteId: string, url: string): Promise<ScanDto> {
  const response = await fetch(apiPath(`/sites/${siteId}/scans`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Failed to start scan (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  return response.json() as Promise<ScanDto>;
}

export async function getScan(scanId: string): Promise<ScanDto> {
  const response = await fetch(apiPath(`/scans/${scanId}`));
  if (!response.ok) {
    throw new Error(`Failed to load scan (${response.status})`);
  }
  return response.json() as Promise<ScanDto>;
}

export async function listScansForSite(siteId: string): Promise<ScanDto[]> {
  const response = await fetch(apiPath(`/sites/${siteId}/scans`));
  if (!response.ok) {
    throw new Error(`Failed to list scans (${response.status})`);
  }
  return response.json() as Promise<ScanDto[]>;
}

export const SIGNOZ_URL =
  process.env["NEXT_PUBLIC_SIGNOZ_URL"] ?? "http://localhost:8080";

const CATEGORY_LABELS: Record<string, string> = {
  structure: "Structure",
  accessibility: "Accessibility",
  semantic: "Semantics",
  crawlability: "Crawlability",
  structured_data: "Structured data",
};

/**
 * Builds a paste-ready agent prompt from a completed Genvora audit report.
 * Users copy this into Cursor / CLI agents to raise their AI-readiness score.
 */
export function buildImprovePrompt(scan: ScanDto): string {
  const domain = scan.site?.domain ?? "the target website";
  const score =
    scan.overallScore === null || scan.overallScore === undefined
      ? "n/a"
      : String(scan.overallScore);

  const severityOrder = { critical: 0, warning: 1, info: 2 } as Record<
    string,
    number
  >;
  const findings = [...scan.recommendations].sort(
    (a, b) =>
      (severityOrder[String(a.severity)] ?? 9) -
      (severityOrder[String(b.severity)] ?? 9),
  );

  const categoryLines =
    scan.categoryScores.length > 0
      ? scan.categoryScores
          .map((c) => {
            const label = CATEGORY_LABELS[c.category] ?? c.category;
            return `- ${label}: ${c.score}/100`;
          })
          .join("\n")
      : "- (no category breakdown available)";

  const findingBlocks =
    findings.length > 0
      ? findings
          .map((rec, i) => {
            const parts = [
              `### ${i + 1}. [${String(rec.severity).toUpperCase()}] ${rec.title}`,
              rec.description,
            ];
            if (rec.fixSnippet?.trim()) {
              parts.push("", "Suggested fix snippet:", "```", rec.fixSnippet.trim(), "```");
            }
            return parts.join("\n");
          })
          .join("\n\n")
      : "(No specific findings were recorded for this scan.)";

  return `You are a senior web engineer improving AI readiness (LLM / agent crawlability) for this site.

## Goal
Raise the Genvora AI-readiness score for **${domain}** (current overall score: **${score}/100**).
Implement concrete code and content changes in this repository. Prefer minimal, production-safe diffs. Do not invent unrelated refactors.

## Category scores
${categoryLines}

## Findings to fix (priority: critical → warning → info)
${findingBlocks}

## Directions
1. Work through **critical** findings first, then **warning**, then **info**.
2. Apply fix snippets where provided; adapt them to this project's stack, routing, and layout conventions.
3. Typical high-impact work includes:
   - Valid JSON-LD / Schema.org on key pages
   - Semantic HTML (\`<main>\`, \`<nav>\`, \`<article>\`, headings hierarchy)
   - Image \`alt\` text and accessible form labels
   - \`robots.txt\` allowing AI crawlers where appropriate
   - An accurate \`llms.txt\` at the site root
4. After changes, summarize what you changed and which findings each change addresses.
5. If something cannot be fixed in-repo (e.g. DNS-only), say so and suggest the exact external step.

## Constraints
- Match existing code style and frameworks in this repo.
- Do not remove analytics, auth, or business logic unless required for a finding.
- Keep copy and branding intact unless a finding explicitly requires content changes.

Start by inspecting the codebase for the pages/templates that render **${domain}**, then implement the critical fixes.`;
}
