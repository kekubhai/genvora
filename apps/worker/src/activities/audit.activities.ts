// Temporal Activities for AI Readiness Audit
// These activities perform the actual work of crawling, parsing, and analyzing web pages

import { chromium, type Browser, type Page } from "playwright";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
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

// User agents to rotate through for AI bot simulation
const AI_USER_AGENTS = [
  "GPTBot/1.0",
  "ClaudeBot/1.0",
  "PerplexityBot/1.0",
  "Google-Extended/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", // Standard browser
];

// =============================================================================
// ACTIVITY 1: fetchPageActivity
// =============================================================================
export async function fetchPageActivity(url: string): Promise<PageFetchResult> {
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
    const randomUA = AI_USER_AGENTS[Math.floor(Math.random() * AI_USER_AGENTS.length)];
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

    // Get raw HTML (before JS execution)
    rawHtml = await page.content();

    // Get rendered HTML (after JS execution)
    renderedHtml = rawHtml; // For now, same as raw - we could disable JS for raw

    // Take screenshot
    screenshot = new Uint8Array(await page.screenshot({ fullPage: true }));

    // Try to fetch robots.txt
    try {
      const robotsUrl = new URL("/robots.txt", finalUrl).toString();
      const robotsResponse = await page.goto(robotsUrl);
      if (robotsResponse && robotsResponse.ok()) {
        robotsTxt = await robotsResponse.text();
      }
    } catch (e) {
      // robots.txt not found or inaccessible
    }

    // Try to fetch llms.txt
    try {
      const llmsUrl = new URL("/llms.txt", finalUrl).toString();
      const llmsResponse = await page.goto(llmsUrl);
      if (llmsResponse && llmsResponse.ok()) {
        llmsTxt = await llmsResponse.text();
      }
    } catch (e) {
      // llms.txt not found or inaccessible
    }
  } finally {
    await browser.close();
  }

  const loadTime = Date.now() - startTime;

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
}

// =============================================================================
// ACTIVITY 2: parseStructureActivity
// =============================================================================
export async function parseStructureActivity(html: string): Promise<StructureAnalysis> {
  const $ = cheerio.load(html);

  // Extract heading hierarchy
  const headingHierarchy: Array<{ level: number; text: string; order: number }> = [];
  $("h1, h2, h3, h4, h5, h6").each((index, element) => {
    const tagName = (element as any).tagName;
    const level = parseInt(tagName.substring(1));
    const text = $(element).text().trim();
    headingHierarchy.push({ level, text, order: index });
  });

  // Check for schema.org JSON-LD
  const jsonLdScripts = $('script[type="application/ld+json"]');
  let hasSchemaOrg = jsonLdScripts.length > 0;
  let schemaOrgValid = false;

  if (hasSchemaOrg) {
    try {
      const jsonData = JSON.parse(jsonLdScripts.first().text());
      schemaOrgValid = jsonData && typeof jsonData === "object";
    } catch (e) {
      schemaOrgValid = false;
    }
  }

  // Extract meta tags
  const metaTags: Record<string, string> = {};
  $("meta").each((_, element) => {
    const name = $(element).attr("name") || $(element).attr("property");
    const content = $(element).attr("content");
    if (name && content) {
      metaTags[name] = content;
    }
  });

  // Calculate semantic HTML ratio
  const semanticTags = $("article, nav, main, aside, section, header, footer, figure, figcaption").length;
  const divCount = $("div").length;
  const totalElements = semanticTags + divCount;
  const semanticHtmlRatio = totalElements > 0 ? semanticTags / totalElements : 0;

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

  // Count internal links
  const internalLinkCount = $("a[href^='/'], a[href^='#']").length;

  return {
    headingHierarchy,
    hasSchemaOrg,
    schemaOrgValid,
    metaTags,
    semanticHtmlRatio,
    altTextCoverage,
    internalLinkCount,
  };
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
  loadTime?: number
): Promise<CrawlabilityAnalysis> {
  // Check robots.txt for AI bot rules
  let robotsTxtAllowsAi = true;
  if (robotsTxt) {
    const lines = robotsTxt.toLowerCase().split("\n");
    const userAgentLines = lines.filter((line) => line.includes("user-agent"));
    const disallowLines = lines.filter((line) => line.includes("disallow"));
    
    // Check if any AI bot is disallowed
    const aiBotPatterns = ["gptbot", "claudebot", "perplexitybot", "google-extended"];
    const hasAiBotSection = userAgentLines.some((line) => 
      aiBotPatterns.some((pattern) => line.includes(pattern))
    );
    
    if (hasAiBotSection && disallowLines.length > 0) {
      robotsTxtAllowsAi = false;
    }
  }

  // Check llms.txt presence and validity
  const hasLlmsTxt = !!llmsTxt && llmsTxt.trim().length > 0;
  const llmsTxtValid = hasLlmsTxt && llmsTxt.includes("http");

  // Check if JS rendering is required
  let requiresJsRendering = false;
  let jsDiffScore = 0;
  if (rawHtml && html) {
    // Simple diff calculation
    const rawLength = rawHtml.length;
    const renderedLength = html.length;
    jsDiffScore = Math.abs(renderedLength - rawLength) / Math.max(rawLength, renderedLength);
    requiresJsRendering = jsDiffScore > 0.3;
  }

  return {
    robotsTxtAllowsAi,
    hasLlmsTxt,
    llmsTxtValid,
    requiresJsRendering,
    jsDiffScore,
    responseCode: statusCode || 200,
    loadTime: loadTime || 0,
  };
}

// =============================================================================
// ACTIVITY 4: analyzeAccessibilityActivity
// =============================================================================
export async function analyzeAccessibilityActivity(html: string): Promise<AccessibilityAnalysis> {
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

  // Check for ARIA labels
  const hasAriaLabels = $('[aria-label], [aria-labelledby], [role]').length > 0;

  // Check form labels
  const formLabelsPresent = $("form").length === 0 || $("form label").length > 0;

  // Color contrast issues (placeholder - would need more sophisticated analysis)
  const colorContrastIssues = 0;

  return {
    missingAltText,
    totalImages,
    hasAriaLabels,
    formLabelsPresent,
    colorContrastIssues,
  };
}

// =============================================================================
// ACTIVITY 5: analyzeSemanticActivity
// =============================================================================
export async function analyzeSemanticActivity(html: string): Promise<SemanticAnalysis> {
  const $ = cheerio.load(html);

  // Check for semantic tags
  const semanticTags = $("article, nav, main, aside, section, header, footer");
  const hasSemanticTags = semanticTags.length > 0;
  const semanticTagCount = semanticTags.length;

  // Count divs
  const divCount = $("div").length;

  // Check for main content area
  const mainContentIdentified = $("main").length > 0 || $('[role="main"]').length > 0;

  // Check for nav
  const navIdentified = $("nav").length > 0 || $('[role="navigation"]').length > 0;

  // Check for footer
  const footerIdentified = $("footer").length > 0 || $('[role="contentinfo"]').length > 0;

  return {
    hasSemanticTags,
    semanticTagCount,
    divCount,
    mainContentIdentified,
    navIdentified,
    footerIdentified,
  };
}

// =============================================================================
// ACTIVITY 6: analyzeStructuredDataActivity
// =============================================================================
export async function analyzeStructuredDataActivity(html: string): Promise<StructuredDataAnalysis> {
  const $ = cheerio.load(html);

  // Check for JSON-LD
  const jsonLdScripts = $('script[type="application/ld+json"]');
  const hasJsonLd = jsonLdScripts.length > 0;
  let jsonLdValid = false;
  const schemaTypes: string[] = [];
  const missingRequiredFields: string[] = [];

  if (hasJsonLd) {
    try {
      const jsonData = JSON.parse(jsonLdScripts.first().text());
      jsonLdValid = true;

      // Extract schema types
      if (Array.isArray(jsonData)) {
        jsonData.forEach((item) => {
          if (item["@type"]) {
            schemaTypes.push(item["@type"]);
          }
        });
      } else if (jsonData["@type"]) {
        schemaTypes.push(jsonData["@type"]);
      }

      // Check for required fields (basic check)
      if (jsonData["@type"] && !jsonData.name && !jsonData.headline) {
        missingRequiredFields.push("name/headline");
      }
    } catch (e) {
      jsonLdValid = false;
    }
  }

  return {
    hasJsonLd,
    jsonLdValid,
    schemaTypes,
    missingRequiredFields,
  };
}

// =============================================================================
// ACTIVITY 7: scoreActivity
// =============================================================================
export async function scoreActivity(
  structure: StructureAnalysis,
  crawlability: CrawlabilityAnalysis,
  accessibility: AccessibilityAnalysis,
  semantic: SemanticAnalysis,
  structuredData: StructuredDataAnalysis
): Promise<ScoringResult> {
  const input: ScoringInput = {
    structure,
    crawlability,
    accessibility,
    semantic,
    structuredData,
  };

  return score(input);
}

// =============================================================================
// ACTIVITY 8: generateRecommendationsActivity
// =============================================================================
export async function generateRecommendationsActivity(
  structure: StructureAnalysis,
  crawlability: CrawlabilityAnalysis,
  accessibility: AccessibilityAnalysis,
  semantic: SemanticAnalysis,
  structuredData: StructuredDataAnalysis
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Structure recommendations
  if (!structure.hasSchemaOrg) {
    recommendations.push({
      id: "rec-1",
      scanId: "", // Will be set by workflow
      severity: "critical",
      title: "Missing Schema.org Markup",
      description: "Add structured data using schema.org vocabulary to help AI systems understand your content.",
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
      description: "Your robots.txt is blocking AI crawlers. Consider allowing them for better AI visibility.",
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
      description: "Add an llms.txt file to provide AI systems with information about your content.",
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
      description: "Some content only appears after JavaScript execution. Consider server-side rendering for better AI crawlability.",
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
      description: "Form inputs lack proper labels. Add <label> elements for accessibility.",
    });
  }

  // Semantic recommendations
  if (!semantic.hasSemanticTags) {
    recommendations.push({
      id: "rec-8",
      scanId: "",
      severity: "warning",
      title: "No Semantic HTML Tags",
      description: "Use semantic HTML tags like <article>, <nav>, <main>, <section> for better structure and AI understanding.",
    });
  }

  if (!semantic.mainContentIdentified) {
    recommendations.push({
      id: "rec-9",
      scanId: "",
      severity: "info",
      title: "Main Content Area Not Identified",
      description: "Use <main> tag or role='main' to identify your primary content area.",
    });
  }

  // Structured data recommendations
  if (!structuredData.hasJsonLd) {
    recommendations.push({
      id: "rec-10",
      scanId: "",
      severity: "critical",
      title: "Missing JSON-LD Structured Data",
      description: "Add JSON-LD structured data to help AI systems understand your content better.",
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

  return recommendations;
}

// =============================================================================
// ACTIVITY 9: storeSnapshotActivity
// =============================================================================
export async function storeSnapshotActivity(
  scanId: string,
  rawHtml: string,
  screenshot: Uint8Array
): Promise<{ rawHtmlUrl: string; screenshotUrl: string }> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const bucketName = "scan-snapshots";

  // Upload raw HTML
  const htmlPath = `scans/${scanId}/raw.html`;
  const { error: htmlError } = await supabase.storage
    .from(bucketName)
    .upload(htmlPath, rawHtml, {
      contentType: "text/html",
      upsert: true,
    });

  if (htmlError) {
    throw new Error(`Failed to upload HTML: ${htmlError.message}`);
  }

  // Upload screenshot
  const screenshotPath = `scans/${scanId}/screenshot.png`;
  const { error: screenshotError } = await supabase.storage
    .from(bucketName)
    .upload(screenshotPath, screenshot, {
      contentType: "image/png",
      upsert: true,
    });

  if (screenshotError) {
    throw new Error(`Failed to upload screenshot: ${screenshotError.message}`);
  }

  return {
    rawHtmlUrl: htmlPath,
    screenshotUrl: screenshotPath,
  };
}