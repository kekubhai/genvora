// Temporal Workflow — must only import from @temporalio/workflow
// No Node.js APIs or external imports are allowed inside workflow files.

import { defineSignal, defineQuery, setHandler } from "@temporalio/workflow";
import { proxyActivities } from "@temporalio/workflow";
import type {
  AuditWorkflowInput,
  PageFetchResult,
  StructureAnalysis,
  CrawlabilityAnalysis,
  AccessibilityAnalysis,
  SemanticAnalysis,
  StructuredDataAnalysis,
  ScoringResult,
  Recommendation,
  LLMSummaryResult,
} from "@repo/shared-types";

// Signal definitions
export const cancelSignal = defineSignal("cancel");

// Query definitions
export const statusQuery = defineQuery<string>("status");

// Activity interface for type safety
interface AuditActivities {
  fetchPageActivity(url: string): Promise<PageFetchResult>;
  parseStructureActivity(html: string): Promise<StructureAnalysis>;
  checkCrawlabilityActivity(
    html: string,
    robotsTxt?: string,
    llmsTxt?: string,
    rawHtml?: string,
    statusCode?: number,
    loadTime?: number
  ): Promise<CrawlabilityAnalysis>;
  analyzeAccessibilityActivity(html: string): Promise<AccessibilityAnalysis>;
  analyzeSemanticActivity(html: string): Promise<SemanticAnalysis>;
  analyzeStructuredDataActivity(html: string): Promise<StructuredDataAnalysis>;
  scoreActivity(
    structure: StructureAnalysis,
    crawlability: CrawlabilityAnalysis,
    accessibility: AccessibilityAnalysis,
    semantic: SemanticAnalysis,
    structuredData: StructuredDataAnalysis
  ): Promise<ScoringResult>;
  generateRecommendationsActivity(
    structure: StructureAnalysis,
    crawlability: CrawlabilityAnalysis,
    accessibility: AccessibilityAnalysis,
    semantic: SemanticAnalysis,
    structuredData: StructuredDataAnalysis
  ): Promise<Recommendation[]>;
  storeSnapshotActivity(scanId: string, rawHtml: string, screenshot: Uint8Array): Promise<{ rawHtmlUrl: string; screenshotUrl: string }>;
  llmSummarizeActivity(input: {
    url: string;
    overallScore: number;
    categoryScores: Record<string, number>;
    recommendations: Recommendation[];
    structure: StructureAnalysis;
    crawlability: CrawlabilityAnalysis;
    accessibility: AccessibilityAnalysis;
    semantic: SemanticAnalysis;
    structuredData: StructuredDataAnalysis;
  }): Promise<LLMSummaryResult>;
}

// Create activity proxy with timeout options
const { fetchPageActivity, parseStructureActivity, checkCrawlabilityActivity, analyzeAccessibilityActivity, analyzeSemanticActivity, analyzeStructuredDataActivity, scoreActivity, generateRecommendationsActivity, storeSnapshotActivity, llmSummarizeActivity } =
  proxyActivities<AuditActivities>({
    startToCloseTimeout: "5 minutes",
  });

/**
 * AuditWorkflow — Performs AI readiness audit for a website
 * Registered on task queue: audit-task-queue
 * 
 * Activities:
 * 1. fetchPageActivity — Crawls the page with AI bot user agents
 * 2. parseStructureActivity — Analyzes HTML structure
 * 3. checkCrawlabilityActivity — Checks robots.txt, llms.txt, JS rendering
 * 4. analyzeAccessibilityActivity — Checks accessibility features
 * 5. analyzeSemanticActivity — Analyzes semantic HTML usage
 * 6. analyzeStructuredDataActivity — Analyzes structured data
 * 7. scoreActivity — Calculates scores using deterministic rubric
 * 8. generateRecommendationsActivity — Generates fix recommendations
 * 9. storeSnapshotActivity — Stores HTML and screenshot in Supabase
 * 10. llmSummarizeActivity — LLM-powered audit summary with agent observability
 */
export async function AuditWorkflow(input: AuditWorkflowInput): Promise<{
  scanId: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  recommendations: Recommendation[];
  llmSummary: {
    executiveSummary: string;
    keyFindings: string[];
    priorityActions: string[];
    estimatedImpact: string;
    tokensUsed: number;
    model: string;
  };
}> {
  let currentStatus = "running";
  let cancelled = false;

  // Set up signal handler
  setHandler(cancelSignal, () => {
    cancelled = true;
  });

  // Set up query handler
  setHandler(statusQuery, () => currentStatus);

  // Extract siteId and URL from input
  const { siteId, url } = input;

  // Generate a scan ID (in production, this would come from the database)
  const scanId = `${siteId}-${Date.now()}`;

  // Activity 1: Fetch page
  const pageFetchResult = await fetchPageActivity(url);

  // Activity 2: Parse structure
  const structureAnalysis = await parseStructureActivity(pageFetchResult.renderedHtml);

  // Activity 3: Check crawlability
  const crawlabilityAnalysis = await checkCrawlabilityActivity(
    pageFetchResult.renderedHtml,
    pageFetchResult.robotsTxt,
    pageFetchResult.llmsTxt,
    pageFetchResult.rawHtml,
    pageFetchResult.statusCode,
    pageFetchResult.loadTime
  );

  // Activity 4: Analyze accessibility
  const accessibilityAnalysis = await analyzeAccessibilityActivity(pageFetchResult.renderedHtml);

  // Activity 5: Analyze semantic HTML
  const semanticAnalysis = await analyzeSemanticActivity(pageFetchResult.renderedHtml);

  // Activity 6: Analyze structured data
  const structuredDataAnalysis = await analyzeStructuredDataActivity(pageFetchResult.renderedHtml);

  // Activity 7: Score
  const scoringResult = await scoreActivity(
    structureAnalysis,
    crawlabilityAnalysis,
    accessibilityAnalysis,
    semanticAnalysis,
    structuredDataAnalysis
  );

  // Activity 8: Generate recommendations
  const recommendations = await generateRecommendationsActivity(
    structureAnalysis,
    crawlabilityAnalysis,
    accessibilityAnalysis,
    semanticAnalysis,
    structuredDataAnalysis
  );

  // Activity 9: Store snapshots (best-effort — missing bucket must not block the report)
  try {
    await storeSnapshotActivity(
      scanId,
      pageFetchResult.rawHtml,
      pageFetchResult.screenshot,
    );
  } catch {
    // soft-fail — scores + recommendations still return
  }

  // Activity 10: LLM summary (best-effort)
  let llmSummary: LLMSummaryResult = {
    executiveSummary: `AI readiness score ${scoringResult.overallScore}/100 for ${url}. Review the severity-ranked findings to improve crawlability, structure, and structured data.`,
    keyFindings: recommendations.slice(0, 5).map((r) => r.title),
    priorityActions: recommendations
      .filter((r) => r.severity === "critical" || r.severity === "warning")
      .slice(0, 5)
      .map((r) => r.title),
    estimatedImpact: "Fixing critical and warning items typically yields the largest score gains.",
    tokensUsed: 0,
    model: "fallback",
  };

  try {
    llmSummary = await llmSummarizeActivity({
      url,
      overallScore: scoringResult.overallScore,
      categoryScores: scoringResult.categoryScores,
      recommendations,
      structure: structureAnalysis,
      crawlability: crawlabilityAnalysis,
      accessibility: accessibilityAnalysis,
      semantic: semanticAnalysis,
      structuredData: structuredDataAnalysis,
    });
  } catch {
    // keep deterministic fallback summary
  }

  currentStatus = "completed";

  // Surface the summary as the first "how to improve" finding in the UI
  const reportRecs: Recommendation[] = [
    {
      scanId,
      severity: "info",
      title: "Executive summary",
      description: [
        llmSummary.executiveSummary,
        llmSummary.priorityActions.length
          ? `Priority actions: ${llmSummary.priorityActions.join("; ")}`
          : "",
        llmSummary.estimatedImpact
          ? `Estimated impact: ${llmSummary.estimatedImpact}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      fixSnippet: undefined,
    },
    ...recommendations.map((rec) => ({ ...rec, scanId })),
  ];

  return {
    scanId,
    overallScore: scoringResult.overallScore,
    categoryScores: scoringResult.categoryScores,
    recommendations: reportRecs,
    llmSummary: {
      executiveSummary: llmSummary.executiveSummary,
      keyFindings: llmSummary.keyFindings,
      priorityActions: llmSummary.priorityActions,
      estimatedImpact: llmSummary.estimatedImpact,
      tokensUsed: llmSummary.tokensUsed,
      model: llmSummary.model,
    },
  };
}