// Scoring Engine — deterministic scoring logic
// Phase 1: AI Readiness Audit scoring implementation

import type {
  ScoringInput,
  ScoringResult,
  CategoryType,
  StructureAnalysis,
  CrawlabilityAnalysis,
  AccessibilityAnalysis,
  SemanticAnalysis,
  StructuredDataAnalysis,
} from "@repo/shared-types";

// =============================================================================
// SCORING RUBRIC
// =============================================================================
// This rubric defines the deterministic scoring rules for AI readiness.
// Each category has a base score of 100, with deductions for failures.
// The overall score is a weighted average of category scores.
//
// CATEGORY WEIGHTS:
// - Structure: 20%
// - Accessibility: 15%
// - Semantic: 15%
// - Crawlability: 30%
// - Structured Data: 20%
//
// DEDUCTION RULES:
// See individual scoring functions below for detailed rules.
// =============================================================================

const CATEGORY_WEIGHTS: Record<CategoryType, number> = {
  structure: 0.2,
  accessibility: 0.15,
  semantic: 0.15,
  crawlability: 0.3,
  structured_data: 0.2,
};

export function scoreStructure(analysis: StructureAnalysis): number {
  let score = 100;

  // Heading hierarchy issues (-10 each)
  const headingLevels = analysis.headingHierarchy.map(h => h.level);
  for (let i = 1; i < headingLevels.length; i++) {
    const currentLevel = headingLevels[i];
    const previousLevel = headingLevels[i - 1];
    if (currentLevel !== undefined && previousLevel !== undefined && currentLevel > previousLevel + 1) {
      score -= 10; // Skipped heading level
    }
  }

  // Missing or invalid schema.org (-15)
  if (!analysis.hasSchemaOrg) {
    score -= 15;
  } else if (!analysis.schemaOrgValid) {
    score -= 10;
  }

  // Low semantic HTML ratio (-20)
  if (analysis.semanticHtmlRatio < 0.3) {
    score -= 20;
  } else if (analysis.semanticHtmlRatio < 0.5) {
    score -= 10;
  }

  // Poor alt text coverage (-15)
  if (analysis.altTextCoverage < 0.5) {
    score -= 15;
  } else if (analysis.altTextCoverage < 0.8) {
    score -= 5;
  }

  // No internal links (-10)
  if (analysis.internalLinkCount === 0) {
    score -= 10;
  }

  return Math.max(0, score);
}

export function scoreAccessibility(analysis: AccessibilityAnalysis): number {
  let score = 100;

  // Missing alt text (-20)
  if (analysis.totalImages > 0) {
    const missingRatio = analysis.missingAltText / analysis.totalImages;
    if (missingRatio > 0.5) {
      score -= 20;
    } else if (missingRatio > 0.2) {
      score -= 10;
    } else if (missingRatio > 0) {
      score -= 5;
    }
  }

  // Missing ARIA labels (-10)
  if (!analysis.hasAriaLabels) {
    score -= 10;
  }

  // Missing form labels (-15)
  if (!analysis.formLabelsPresent) {
    score -= 15;
  }

  // Color contrast issues (-10 each)
  score -= analysis.colorContrastIssues * 10;

  return Math.max(0, score);
}

export function scoreSemantic(analysis: SemanticAnalysis): number {
  let score = 100;

  // No semantic tags (-30)
  if (!analysis.hasSemanticTags) {
    score -= 30;
  }

  // Low semantic tag ratio (-20)
  const totalElements = analysis.semanticTagCount + analysis.divCount;
  if (totalElements > 0) {
    const semanticRatio = analysis.semanticTagCount / totalElements;
    if (semanticRatio < 0.2) {
      score -= 20;
    } else if (semanticRatio < 0.4) {
      score -= 10;
    }
  }

  // Missing main content area (-15)
  if (!analysis.mainContentIdentified) {
    score -= 15;
  }

  // Missing nav (-10)
  if (!analysis.navIdentified) {
    score -= 10;
  }

  // Missing footer (-5)
  if (!analysis.footerIdentified) {
    score -= 5;
  }

  return Math.max(0, score);
}

export function scoreCrawlability(analysis: CrawlabilityAnalysis): number {
  let score = 100;

  // AI blocked in robots.txt (-25)
  if (!analysis.robotsTxtAllowsAi) {
    score -= 25;
  }

  // Missing llms.txt (-15)
  if (!analysis.hasLlmsTxt) {
    score -= 15;
  } else if (!analysis.llmsTxtValid) {
    score -= 5;
  }

  // Requires JS rendering (-20)
  if (analysis.requiresJsRendering) {
    score -= 20;
  }

  // High JS diff score (-15)
  if (analysis.jsDiffScore > 0.5) {
    score -= 15;
  } else if (analysis.jsDiffScore > 0.3) {
    score -= 5;
  }

  // Non-200 response code (-20)
  if (analysis.responseCode < 200 || analysis.responseCode >= 300) {
    score -= 20;
  }

  // Slow load time (-10)
  if (analysis.loadTime > 3000) {
    score -= 10;
  } else if (analysis.loadTime > 1500) {
    score -= 5;
  }

  return Math.max(0, score);
}

export function scoreStructuredData(analysis: StructuredDataAnalysis): number {
  let score = 100;

  // No JSON-LD (-30)
  if (!analysis.hasJsonLd) {
    score -= 30;
  }

  // Invalid JSON-LD (-20)
  if (!analysis.jsonLdValid) {
    score -= 20;
  }

  // No schema types (-15)
  if (analysis.schemaTypes.length === 0) {
    score -= 15;
  }

  // Missing required fields (-5 each)
  score -= analysis.missingRequiredFields.length * 5;

  return Math.max(0, score);
}

export function score(input: ScoringInput): ScoringResult {
  const categoryScores: Record<CategoryType, number> = {
    structure: scoreStructure(input.structure),
    accessibility: scoreAccessibility(input.accessibility),
    semantic: scoreSemantic(input.semantic),
    crawlability: scoreCrawlability(input.crawlability),
    structured_data: scoreStructuredData(input.structuredData),
  };

  // Calculate weighted overall score
  const overallScore = Object.entries(categoryScores).reduce(
    (sum, [category, score]) => sum + score * CATEGORY_WEIGHTS[category as CategoryType],
    0
  );

  return {
    overallScore: Math.round(overallScore),
    categoryScores,
    details: {
      structure: input.structure,
      accessibility: input.accessibility,
      semantic: input.semantic,
      crawlability: input.crawlability,
      structured_data: input.structuredData,
    },
  };
}
