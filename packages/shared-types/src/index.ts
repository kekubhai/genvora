// Shared TypeScript types used across apps/api, apps/worker, apps/web

export type OrgRole = "admin" | "member";

export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  dependencies: {
    postgres: "connected" | "unavailable";
    redis: "connected" | "unavailable";
  };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Temporal task queues
export const TASK_QUEUES = {
  PING: "ping-task-queue",
  AUDIT: "audit-task-queue",
} as const;

export type TaskQueue = (typeof TASK_QUEUES)[keyof typeof TASK_QUEUES];

// Scan-related types
export type ScanStatus = "queued" | "running" | "completed" | "failed";

export type CategoryType = "structure" | "accessibility" | "semantic" | "crawlability" | "structured_data";

export type Severity = "critical" | "warning" | "info";

export interface CategoryScore {
  id: string;
  scanId: string;
  category: CategoryType;
  score: number; // 0-100
  details: Record<string, unknown>;
}

export interface Recommendation {
  id: string;
  scanId: string;
  severity: Severity;
  title: string;
  description: string;
  fixSnippet?: string;
}

export interface Scan {
  id: string;
  siteId: string;
  status: ScanStatus;
  overallScore?: number;
  rawHtmlUrl?: string;
  screenshotUrl?: string;
  createdAt: Date;
  completedAt?: Date;
  categoryScores: CategoryScore[];
  recommendations: Recommendation[];
}

// Audit workflow types
export interface AuditWorkflowInput {
  siteId: string;
  url: string;
}

export interface PageFetchResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  rawHtml: string;
  renderedHtml: string;
  screenshot: Uint8Array;
  robotsTxt?: string;
  llmsTxt?: string;
  loadTime: number;
}

export interface StructureAnalysis {
  headingHierarchy: Array<{ level: number; text: string; order: number }>;
  hasSchemaOrg: boolean;
  schemaOrgValid: boolean;
  metaTags: Record<string, string>;
  semanticHtmlRatio: number;
  altTextCoverage: number;
  internalLinkCount: number;
}

export interface CrawlabilityAnalysis {
  robotsTxtAllowsAi: boolean;
  hasLlmsTxt: boolean;
  llmsTxtValid: boolean;
  requiresJsRendering: boolean;
  jsDiffScore: number;
  responseCode: number;
  loadTime: number;
}

export interface AccessibilityAnalysis {
  missingAltText: number;
  totalImages: number;
  hasAriaLabels: boolean;
  formLabelsPresent: boolean;
  colorContrastIssues: number;
}

export interface SemanticAnalysis {
  hasSemanticTags: boolean;
  semanticTagCount: number;
  divCount: number;
  mainContentIdentified: boolean;
  navIdentified: boolean;
  footerIdentified: boolean;
}

export interface StructuredDataAnalysis {
  hasJsonLd: boolean;
  jsonLdValid: boolean;
  schemaTypes: string[];
  missingRequiredFields: string[];
}

export interface ScoringInput {
  structure: StructureAnalysis;
  crawlability: CrawlabilityAnalysis;
  accessibility: AccessibilityAnalysis;
  semantic: SemanticAnalysis;
  structuredData: StructuredDataAnalysis;
}

export interface ScoringResult {
  overallScore: number;
  categoryScores: Record<CategoryType, number>;
  details: Record<CategoryType, unknown>;
}

// =============================================================================
// LLM Task Completion types
// =============================================================================

export interface LLMSummaryInput {
  url: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  recommendations: Recommendation[];
  structure: StructureAnalysis;
  crawlability: CrawlabilityAnalysis;
  accessibility: AccessibilityAnalysis;
  semantic: SemanticAnalysis;
  structuredData: StructuredDataAnalysis;
}

export interface LLMSummaryResult {
  executiveSummary: string;
  keyFindings: string[];
  priorityActions: string[];
  estimatedImpact: string;
  tokensUsed: number;
  model: string;
}
