// Temporal Activities for AI Readiness Audit
// Each activity is wrapped in an OpenTelemetry span with rich attributes
// so traces in SigNoz show exactly what happened and why.

import { chromium, type Browser, type Page } from "playwright";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import type {
  PageFetchResult,
  StructureAnalysis,
  CrawlabilityAnalysis,
  AccessibilityAnalysis,
  SemanticAnalysis,
  StructuredDataAnalysis,
  ScoringInput,
  ScoringResult,
  CategoryType,
  Recommendation,
} from "@repo/shared-types";
import { score } from "@repo/scoring-engine";

const tracer = trace.getTracer("genvora-worker");

// User agents to rotate through for AI bot simulation
const AI_USER_AGENTS = [
  "GPTBot/1.0",
  "ClaudeBot/1.0",
  "PerplexityBot/1.0",
  "Google-Extended/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

// =============================================================================
// ACTIVITY 1: fetchPageActivity
// =============================================================================
export async function fetchPageActivity(url: string): Promise<PageFetchResult> {
  return tracer.startActiveSpan("activity.fetch_page", async (span) => {
    span.setAttribute("url.target", url);
    span.setAttribute("activity.name", "fetchPageActivity");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const startTime = Date.now();
    let finalUrl = url;
    let statusCode = 200;
    let headers: Record<string, string> = {};
    let rawHtml = "";
    let renderedHtml = "";
    let screenshot: Uint8Array;
    let robotsTxt: string | undefined;
    let llmsTxt: string | undefined;

    try {
      // Set random AI user agent
      const randomUA =
        AI_USER_AGENTS[Math.floor(Math.random() * AI_USER_AGENTS.length)];
      span.setAttribute("user_agent.selected", randomUA);
      await page.setExtraHTTPHeaders({ "User-Agent": randomUA });

      // Capture response headers
      page.on("response", async (response) => {
        if (response.url() === finalUrl) {
          statusCode = response.status();
          const responseHeaders = response.headers();
          headers = {};
          for (const [key, value] of Object.entries(responseHeaders)) {
            headers[key] = value;
          }
        }
      });

      // Navigate to page
      const response = await page.goto(url, { waitUntil: "networkidle" });
      if (response) {
        finalUrl = response.url();
        statusCode = response.status();
        const responseHeaders = response.headers();
        headers = {};
        for (const [key, value] of Object.entries(responseHeaders)) {
          headers[key] = value;
        }
      }

      span.setAttribute("http.status_code", statusCode);
      span.setAttribute("url.final", finalUrl);
      span.setAttribute("url.redirected", finalUrl !== url);

      // Get raw HTML (before JS execution)
      rawHtml = await page.content();
      renderedHtml = rawHtml;

      span.setAttribute("html.raw_bytes", rawHtml.length);

      // Take screenshot
      screenshot = new Uint8Array(
        await page.screenshot({ fullPage: true }),
      );
      span.setAttribute("screenshot.bytes", screenshot.length);

      // Try to fetch robots.txt
      try {
        const robotsUrl = new URL("/robots.txt", finalUrl).toString();
        const robotsResponse = await page.goto(robotsUrl);
        if (robotsResponse && robotsResponse.ok()) {
          robotsTxt = await robotsResponse.text();
          span.setAttribute("robots_txt.found", true);
          span.setAttribute("robots_txt.bytes", robotsTxt.length);
        }
      } catch {
        span.setAttribute("robots_txt.found", false);
      }

      // Try to fetch llms.txt
      try {
        const llmsUrl = new URL("/llms.txt", finalUrl).toString();
        const llmsResponse = await page.goto(llmsUrl);
        if (llmsResponse && llmsResponse.ok()) {
          llmsTxt = await llmsResponse.text();
          span.setAttribute("llms_txt.found", true);
          span.setAttribute("llms_txt.bytes", llmsTxt.length);
        }
      } catch {
        span.setAttribute("llms_txt.found", false);
      }
    } finally {
      await browser.close();
    }

    const loadTime = Date.now() - startTime;
    span.setAttribute("http.load_time_ms", loadTime);
    span.setAttribute("http.headers.count", Object.keys(headers).length);

    span.end();

    return {
      url,
      finalUrl,
      statusCode,
      headers,
      rawHtml,
      renderedHtml,
      screenshot,
      robotsTxt,
      llmsTxt,
      loadTime,
    };
  });
}

// =============================================================================
// ACTIVITY 2: parseStructureActivity
// =============================================================================
export async function parseStructureActivity(
  html: string,
): Promise<StructureAnalysis> {
  return tracer.startActiveSpan("activity.parse_structure", async (span) => {
    span.setAttribute("activity.name", "parseStructureActivity");
    span.setAttribute("html.bytes", html.length);

    const $ = cheerio.load(html);

    // Extract heading hierarchy
    const headingHierarchy: Array<{
      level: number;
      text: string;
      order: number;
    }> = [];
    $("h1, h2, h3, h4, h5, h6").each((index, element) => {
      const tagName = (element as any).tagName;
      const level = parseInt(tagName.substring(1));
      const text = $(element).text().trim();
      headingHierarchy.push({ level, text, order: index });
    });

    span.setAttribute("headings.total", headingHierarchy.length);
    span.setAttribute(
      "headings.max_level",
      headingHierarchy.reduce((max, h) => Math.max(max, h.level), 0),
    );

    // Check for schema.org JSON-LD
    const jsonLdScripts = $('script[type="application/ld+json"]');
    let hasSchemaOrg = jsonLdScripts.length > 0;
    let schemaOrgValid = false;

    if (hasSchemaOrg) {
      try {
        const jsonData = JSON.parse(jsonLdScripts.first().text());
        schemaOrgValid = jsonData && typeof jsonData === "object";
      } catch {
        schemaOrgValid = false;
      }
    }

    span.setAttribute("schema_org.found", hasSchemaOrg);
    span.setAttribute("schema_org.valid", schemaOrgValid);

    // Extract meta tags
    const metaTags: Record<string, string> = {};
    $("meta").each((_, element) => {
      const name =
        $(element).attr("name") || $(element).attr("property");
      const content = $(element).attr("content");
      if (name && content) {
        metaTags[name] = content;
      }
    });

    span.setAttribute("meta_tags.count", Object.keys(metaTags).length);
    span.setAttribute(
      "meta_tags.has_description",
      !!metaTags["description"],
    );
    span.setAttribute("meta_tags.has_og_title", !!metaTags["og:title"]);

    // Calculate semantic HTML ratio
    const semanticTags = $(
      "article, nav, main, aside, section, header, footer, figure, figcaption",
    ).length;
    const divCount = $("div").length;
    const totalElements = semanticTags + divCount;
    const semanticHtmlRatio =
      totalElements > 0 ? semanticTags / totalElements : 0;

    span.setAttribute("semantic.element_count", semanticTags);
    span.setAttribute("semantic.div_count", divCount);
    span.setAttribute("semantic.html_ratio", semanticHtmlRatio);

    // Calculate alt text coverage
    const images = $("img");
    const totalImages = images.length;
    let imagesWithAlt = 0;
    images.each((_, element) => {
      if ($(element).attr("alt")) {
        imagesWithAlt++;
      }
    });
    const altTextCoverage = totalImages > 0 ? imagesWithAlt / totalImages : 1;

    span.setAttribute("images.total", totalImages);
    span.setAttribute("images.with_alt", imagesWithAlt);
    span.setAttribute("images.alt_text_coverage", altTextCoverage);

    // Count internal links
    const internalLinkCount = $("a[href^='/'], a[href^='#']").length;
    span.setAttribute("links.internal", internalLinkCount);

    span.end();

    return {
      headingHierarchy,
      hasSchemaOrg,
      schemaOrgValid,
      metaTags,
      semanticHtmlRatio,
      altTextCoverage,
      internalLinkCount,
    };
  });
}

// =============================================================================
// ACTIVITY 3: checkCrawlabilityActivity
// =============================================================================
export async function checkCrawlabilityActivity(
  html: string,
  robotsTxt?: string,
  llmsTxt?: string,
  rawHtml?: string,
  statusCode?: number,
  loadTime?: number,
): Promise<CrawlabilityAnalysis> {
  return tracer.startActiveSpan("activity.check_crawlability", async (span) => {
    span.setAttribute("activity.name", "checkCrawlabilityActivity");

    // Check robots.txt for AI bot rules
    let robotsTxtAllowsAi = true;
    if (robotsTxt) {
      const lines = robotsTxt.toLowerCase().split("\n");
      const userAgentLines = lines.filter((line) =>
        line.includes("user-agent"),
      );
      const disallowLines = lines.filter((line) =>
        line.includes("disallow"),
      );

      const aiBotPatterns = [
        "gptbot",
        "claudebot",
        "perplexitybot",
        "google-extended",
      ];
      const hasAiBotSection = userAgentLines.some((line) =>
        aiBotPatterns.some((pattern) => line.includes(pattern)),
      );

      if (hasAiBotSection && disallowLines.length > 0) {
        robotsTxtAllowsAi = false;
      }
    }

    span.setAttribute("robots_txt.provided", !!robotsTxt);
    span.setAttribute("robots_txt.allows_ai", robotsTxtAllowsAi);

    // Check llms.txt presence and validity
    const hasLlmsTxt = !!llmsTxt && llmsTxt.trim().length > 0;
    const llmsTxtValid = hasLlmsTxt && llmsTxt.includes("http");

    span.setAttribute("llms_txt.provided", !!llmsTxt);
    span.setAttribute("llms_txt.present", hasLlmsTxt);
    span.setAttribute("llms_txt.valid", llmsTxtValid);

    // Check if JS rendering is required
    let requiresJsRendering = false;
    let jsDiffScore = 0;
    if (rawHtml && html) {
      const rawLength = rawHtml.length;
      const renderedLength = html.length;
      jsDiffScore =
        Math.abs(renderedLength - rawLength) /
        Math.max(rawLength, renderedLength);
      requiresJsRendering = jsDiffScore > 0.3;
    }

    span.setAttribute("js_rendering.required", requiresJsRendering);
    span.setAttribute("js_rendering.diff_score", jsDiffScore);
    span.setAttribute(
      "js_rendering.raw_bytes",
      rawHtml?.length ?? 0,
    );
    span.setAttribute(
      "js_rendering.rendered_bytes",
      html.length,
    );

    span.setAttribute("http.response_code", statusCode ?? 200);
    span.setAttribute("http.load_time_ms", loadTime ?? 0);

    const issues: string[] = [];
    if (!robotsTxtAllowsAi) issues.push("ai_bots_blocked");
    if (!hasLlmsTxt) issues.push("missing_llms_txt");
    if (requiresJsRendering) issues.push("requires_js_rendering");
    span.setAttribute("crawlability.issue_count", issues.length);
    if (issues.length > 0) {
      span.setAttribute("crawlability.issues", issues.join(","));
    }

    span.end();

    return {
      robotsTxtAllowsAi,
      hasLlmsTxt,
      llmsTxtValid,
      requiresJsRendering,
      jsDiffScore,
      responseCode: statusCode || 200,
      loadTime: loadTime || 0,
    };
  });
}

// =============================================================================
// ACTIVITY 4: analyzeAccessibilityActivity
// =============================================================================
export async function analyzeAccessibilityActivity(
  html: string,
): Promise<AccessibilityAnalysis> {
  return tracer.startActiveSpan(
    "activity.analyze_accessibility",
    async (span) => {
      span.setAttribute("activity.name", "analyzeAccessibilityActivity");

      const $ = cheerio.load(html);

      // Check alt text
      const images = $("img");
      const totalImages = images.length;
      let missingAltText = 0;
      images.each((_, element) => {
        if (!$(element).attr("alt")) {
          missingAltText++;
        }
      });

      span.setAttribute("accessibility.total_images", totalImages);
      span.setAttribute("accessibility.missing_alt_text", missingAltText);

      // Check for ARIA labels
      const ariaElements = $(
        '[aria-label], [aria-labelledby], [role]',
      );
      const hasAriaLabels = ariaElements.length > 0;
      span.setAttribute("accessibility.has_aria_labels", hasAriaLabels);
      span.setAttribute(
        "accessibility.aria_element_count",
        ariaElements.length,
      );

      // Check form labels
      const formCount = $("form").length;
      const labelCount = $("form label").length;
      const formLabelsPresent = formCount === 0 || labelCount > 0;

      span.setAttribute("accessibility.forms_total", formCount);
      span.setAttribute("accessibility.form_labels", labelCount);
      span.setAttribute(
        "accessibility.form_labels_present",
        formLabelsPresent,
      );

      // Color contrast issues (placeholder)
      const colorContrastIssues = 0;

      const totalIssues = missingAltText + colorContrastIssues;
      span.setAttribute("accessibility.issue_count", totalIssues);
      span.setAttribute(
        "accessibility.score_indicator",
        totalIssues === 0 ? "pass" : "needs_work",
      );

      span.end();

      return {
        missingAltText,
        totalImages,
        hasAriaLabels,
        formLabelsPresent,
        colorContrastIssues,
      };
    },
  );
}

// =============================================================================
// ACTIVITY 5: analyzeSemanticActivity
// =============================================================================
export async function analyzeSemanticActivity(
  html: string,
): Promise<SemanticAnalysis> {
  return tracer.startActiveSpan("activity.analyze_semantic", async (span) => {
    span.setAttribute("activity.name", "analyzeSemanticActivity");

    const $ = cheerio.load(html);

    // Check for semantic tags
    const semanticTags = $(
      "article, nav, main, aside, section, header, footer",
    );
    const hasSemanticTags = semanticTags.length > 0;
    const semanticTagCount = semanticTags.length;

    // Count divs
    const divCount = $("div").length;

    // Check for main content area
    const mainContentIdentified =
      $("main").length > 0 || $('[role="main"]').length > 0;

    // Check for nav
    const navIdentified =
      $("nav").length > 0 || $('[role="navigation"]').length > 0;

    // Check for footer
    const footerIdentified =
      $("footer").length > 0 || $('[role="contentinfo"]').length > 0;

    span.setAttribute("semantic.tag_count", semanticTagCount);
    span.setAttribute("semantic.div_count", divCount);
    span.setAttribute("semantic.has_semantic_tags", hasSemanticTags);
    span.setAttribute("semantic.main_identified", mainContentIdentified);
    span.setAttribute("semantic.nav_identified", navIdentified);
    span.setAttribute("semantic.footer_identified", footerIdentified);

    const coverage = divCount + semanticTagCount > 0
      ? semanticTagCount / (divCount + semanticTagCount)
      : 0;
    span.setAttribute("semantic.coverage_ratio", coverage);

    span.end();

    return {
      hasSemanticTags,
      semanticTagCount,
      divCount,
      mainContentIdentified,
      navIdentified,
      footerIdentified,
    };
  });
}

// =============================================================================
// ACTIVITY 6: analyzeStructuredDataActivity
// =============================================================================
export async function analyzeStructuredDataActivity(
  html: string,
): Promise<StructuredDataAnalysis> {
  return tracer.startActiveSpan(
    "activity.analyze_structured_data",
    async (span) => {
      span.setAttribute("activity.name", "analyzeStructuredDataActivity");

      const $ = cheerio.load(html);

      // Check for JSON-LD
      const jsonLdScripts = $('script[type="application/ld+json"]');
      const hasJsonLd = jsonLdScripts.length > 0;
      let jsonLdValid = false;
      const schemaTypes: string[] = [];
      const missingRequiredFields: string[] = [];

      span.setAttribute("structured_data.json_ld_blocks", jsonLdScripts.length);

      if (hasJsonLd) {
        try {
          const jsonData = JSON.parse(jsonLdScripts.first().text());
          jsonLdValid = true;

          if (Array.isArray(jsonData)) {
            jsonData.forEach((item: any) => {
              if (item["@type"]) {
                schemaTypes.push(item["@type"]);
              }
            });
          } else if (jsonData["@type"]) {
            schemaTypes.push(jsonData["@type"]);
          }

          if (jsonData["@type"] && !jsonData.name && !jsonData.headline) {
            missingRequiredFields.push("name/headline");
          }
        } catch {
          jsonLdValid = false;
        }
      }

      span.setAttribute("structured_data.valid", jsonLdValid);
      span.setAttribute(
        "structured_data.schema_types",
        schemaTypes.join(",") || "none",
      );
      span.setAttribute(
        "structured_data.schema_type_count",
        schemaTypes.length,
      );
      span.setAttribute(
        "structured_data.missing_fields",
        missingRequiredFields.join(",") || "none",
      );
      span.setAttribute(
        "structured_data.missing_fields_count",
        missingRequiredFields.length,
      );

      span.end();

      return {
        hasJsonLd,
        jsonLdValid,
        schemaTypes,
        missingRequiredFields,
      };
    },
  );
}

// =============================================================================
// ACTIVITY 7: scoreActivity
// =============================================================================
export async function scoreActivity(
  structure: StructureAnalysis,
  crawlability: CrawlabilityAnalysis,
  accessibility: AccessibilityAnalysis,
  semantic: SemanticAnalysis,
  structuredData: StructuredDataAnalysis,
): Promise<ScoringResult> {
  return tracer.startActiveSpan("activity.score", async (span) => {
    span.setAttribute("activity.name", "scoreActivity");

    const input: ScoringInput = {
      structure,
      crawlability,
      accessibility,
      semantic,
      structuredData,
    };

    const result = score(input);

    span.setAttribute("score.overall", result.overallScore);
    for (const [category, scoreVal] of Object.entries(result.categoryScores)) {
      span.setAttribute(`score.category.${category}`, scoreVal);
    }

    // Determine grade
    let grade = "F";
    if (result.overallScore >= 90) grade = "A";
    else if (result.overallScore >= 80) grade = "B";
    else if (result.overallScore >= 70) grade = "C";
    else if (result.overallScore >= 60) grade = "D";
    span.setAttribute("score.grade", grade);

    span.end();

    return result;
  });
}

// =============================================================================
// ACTIVITY 8: generateRecommendationsActivity
// =============================================================================
export async function generateRecommendationsActivity(
  structure: StructureAnalysis,
  crawlability: CrawlabilityAnalysis,
  accessibility: AccessibilityAnalysis,
  semantic: SemanticAnalysis,
  structuredData: StructuredDataAnalysis,
): Promise<Recommendation[]> {
  return tracer.startActiveSpan(
    "activity.generate_recommendations",
    async (span) => {
      span.setAttribute("activity.name", "generateRecommendationsActivity");

      const recommendations: Recommendation[] = [];

      // Structure recommendations
      if (!structure.hasSchemaOrg) {
        recommendations.push({
          id: "rec-1",
          scanId: "",
          severity: "critical",
          title: "Missing Schema.org Markup",
          description:
            "Add structured data using schema.org vocabulary to help AI systems understand your content.",
          fixSnippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Your Page Title",
  "description": "Your page description"
}
</script>`,
        });
      }

      if (structure.altTextCoverage < 0.8) {
        recommendations.push({
          id: "rec-2",
          scanId: "",
          severity: "warning",
          title: "Poor Image Alt Text Coverage",
          description: `${Math.round((1 - structure.altTextCoverage) * 100)}% of images are missing alt text. Add descriptive alt text for accessibility and AI understanding.`,
        });
      }

      // Crawlability recommendations
      if (!crawlability.robotsTxtAllowsAi) {
        recommendations.push({
          id: "rec-3",
          scanId: "",
          severity: "critical",
          title: "AI Bots Blocked in robots.txt",
          description:
            "Your robots.txt is blocking AI crawlers. Consider allowing them for better AI visibility.",
          fixSnippet: `User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /`,
        });
      }

      if (!crawlability.hasLlmsTxt) {
        recommendations.push({
          id: "rec-4",
          scanId: "",
          severity: "warning",
          title: "Missing llms.txt File",
          description:
            "Add an llms.txt file to provide AI systems with information about your content.",
          fixSnippet: `# llms.txt file
# Title: Your Site Name
# Description: Your site description
# API: https://api.yoursite.com`,
        });
      }

      if (crawlability.requiresJsRendering) {
        recommendations.push({
          id: "rec-5",
          scanId: "",
          severity: "warning",
          title: "Content Requires JavaScript Rendering",
          description:
            "Some content only appears after JavaScript execution. Consider server-side rendering for better AI crawlability.",
        });
      }

      // Accessibility recommendations
      if (accessibility.missingAltText > 0) {
        recommendations.push({
          id: "rec-6",
          scanId: "",
          severity: "warning",
          title: "Missing Alt Text on Images",
          description: `${accessibility.missingAltText} images are missing alt text, affecting accessibility and AI understanding.`,
        });
      }

      if (!accessibility.formLabelsPresent) {
        recommendations.push({
          id: "rec-7",
          scanId: "",
          severity: "warning",
          title: "Missing Form Labels",
          description:
            "Form inputs lack proper labels. Add <label> elements for accessibility.",
        });
      }

      // Semantic recommendations
      if (!semantic.hasSemanticTags) {
        recommendations.push({
          id: "rec-8",
          scanId: "",
          severity: "warning",
          title: "No Semantic HTML Tags",
          description:
            "Use semantic HTML tags like <article>, <nav>, <main>, <section> for better structure and AI understanding.",
        });
      }

      if (!semantic.mainContentIdentified) {
        recommendations.push({
          id: "rec-9",
          scanId: "",
          severity: "info",
          title: "Main Content Area Not Identified",
          description:
            "Use <main> tag or role='main' to identify your primary content area.",
        });
      }

      // Structured data recommendations
      if (!structuredData.hasJsonLd) {
        recommendations.push({
          id: "rec-10",
          scanId: "",
          severity: "critical",
          title: "Missing JSON-LD Structured Data",
          description:
            "Add JSON-LD structured data to help AI systems understand your content better.",
          fixSnippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Your Site Name",
  "url": "https://yoursite.com"
}
</script>`,
        });
      }

      // Span attributes
      span.setAttribute(
        "recommendations.total",
        recommendations.length,
      );
      span.setAttribute(
        "recommendations.critical",
        recommendations.filter((r) => r.severity === "critical").length,
      );
      span.setAttribute(
        "recommendations.warning",
        recommendations.filter((r) => r.severity === "warning").length,
      );
      span.setAttribute(
        "recommendations.info",
        recommendations.filter((r) => r.severity === "info").length,
      );
      span.setAttribute(
        "recommendations.titles",
        recommendations.map((r) => r.title).join("; "),
      );

      span.end();

      return recommendations;
    },
  );
}

// =============================================================================
// ACTIVITY 9: storeSnapshotActivity
// =============================================================================
export async function storeSnapshotActivity(
  scanId: string,
  rawHtml: string,
  screenshot: Uint8Array,
): Promise<{ rawHtmlUrl: string; screenshotUrl: string }> {
  return tracer.startActiveSpan("activity.store_snapshot", async (span) => {
    span.setAttribute("activity.name", "storeSnapshotActivity");
    span.setAttribute("scan_id", scanId);
    span.setAttribute("snapshot.html_bytes", rawHtml.length);
    span.setAttribute("snapshot.screenshot_bytes", screenshot.length);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: "Missing Supabase credentials" });
      span.end();
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const bucketName = "scan-snapshots";

    // Upload raw HTML
    const htmlPath = `scans/${scanId}/raw.html`;
    span.setAttribute("snapshot.html_path", htmlPath);

    const { error: htmlError } = await supabase.storage
      .from(bucketName)
      .upload(htmlPath, rawHtml, {
        contentType: "text/html",
        upsert: true,
      });

    if (htmlError) {
      span.setAttribute("snapshot.html_upload.error", htmlError.message);
      span.setStatus({ code: SpanStatusCode.ERROR, message: htmlError.message });
      span.end();
      throw new Error(`Failed to upload HTML: ${htmlError.message}`);
    }
    span.setAttribute("snapshot.html_upload.success", true);

    // Upload screenshot
    const screenshotPath = `scans/${scanId}/screenshot.png`;
    span.setAttribute("snapshot.screenshot_path", screenshotPath);

    const { error: screenshotError } = await supabase.storage
      .from(bucketName)
      .upload(screenshotPath, screenshot, {
        contentType: "image/png",
        upsert: true,
      });

    if (screenshotError) {
      span.setAttribute(
        "snapshot.screenshot_upload.error",
        screenshotError.message,
      );
      span.setStatus({ code: SpanStatusCode.ERROR, message: screenshotError.message });
      span.end();
      throw new Error(
        `Failed to upload screenshot: ${screenshotError.message}`,
      );
    }
    span.setAttribute("snapshot.screenshot_upload.success", true);

    span.end();

    return {
      rawHtmlUrl: htmlPath,
      screenshotUrl: screenshotPath,
    };
  });
}
