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
  process.env["NEXT_PUBLIC_SIGNOZ_URL"] ?? "http://localhost:3333";
