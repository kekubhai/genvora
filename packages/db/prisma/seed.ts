// =============================================================================
// Seed script — populates the database with realistic demo data.
//
// Usage:
//   npx prisma db seed          (from packages/db/)
//   npm run db:seed             (from root)
//
// Requires DATABASE_URL in packages/db/.env or root .env
// =============================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomId(): string {
  return Math.random().toString(36).slice(2, 15);
}

function randomScore(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const DEMO_USERS = [
  { id: "user_demo_1", name: "Alice Chen", email: "alice@genvora.dev" },
  { id: "user_demo_2", name: "Bob Kumar", email: "bob@genvora.dev" },
];

const DEMO_ORGS = [
  { id: "org_demo_1", name: "Genvora HQ", slug: "genvora-hq" },
];

const DEMO_SITES = [
  { domain: "example.com" },
  { domain: "acme-corp.io" },
  { domain: "blog.techstartup.dev" },
  { domain: "shop-ecommerce.com" },
  { domain: "portfolio-designer.co" },
];

const CATEGORIES = ["structure", "accessibility", "semantic", "crawlability", "structured_data"] as const;

const CRITICAL_RECS = [
  { title: "Add robots.txt for AI crawlers", description: "Your robots.txt is missing or blocking AI crawlers like GPTBot. This prevents search engines and AI assistants from indexing your content." },
  { title: "Add JSON-LD structured data", description: "No Schema.org structured data found. Adding JSON-LD helps search engines understand your content and enables rich results." },
  { title: "Fix missing alt text on images", description: "Multiple images are missing alt text attributes. This hurts accessibility and prevents AI from understanding image content." },
  { title: "Enable server-side rendering", description: "Content requires JavaScript rendering. Many AI crawlers and search bots cannot execute JS, so they see an empty page." },
];

const WARNING_RECS = [
  { title: "Add llms.txt file", description: "No llms.txt found. This file helps AI assistants understand your site's purpose and content structure." },
  { title: "Improve heading hierarchy", description: "Heading levels skip (e.g., h1 to h3). Proper heading hierarchy helps both accessibility and content understanding." },
  { title: "Use semantic HTML tags", description: "Low use of semantic HTML (<article>, <nav>, <section>). Semantic markup improves content parsing by AI and search engines." },
  { title: "Add form labels", description: "Form inputs are missing associated labels. This hurts accessibility and makes forms harder for AI to interpret." },
  { title: "Increase internal linking", description: "Very few internal links found. Internal links help crawlers discover content and understand site structure." },
];

const INFO_RECS = [
  { title: "Add meta description", description: "No meta description found. A concise description improves click-through rates from search results." },
  { title: "Optimize Open Graph tags", description: "Missing or incomplete Open Graph tags. These control how your site appears when shared on social media." },
  { title: "Add canonical URL", description: "No canonical URL specified. This helps prevent duplicate content issues across different URL variations." },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding database...");

  // Clean existing data (order matters for foreign keys)
  await prisma.recommendation.deleteMany();
  await prisma.categoryScore.deleteMany();
  await prisma.scan.deleteMany();
  await prisma.site.deleteMany();
  await prisma.member.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();

  // --- Users ---
  const now = new Date();
  for (const user of DEMO_USERS) {
    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: true,
        image: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  console.log(`  Created ${DEMO_USERS.length} users`);

  // --- Organizations ---
  for (const org of DEMO_ORGS) {
    await prisma.organization.create({
      data: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: now,
      },
    });
  }
  console.log(`  Created ${DEMO_ORGS.length} organizations`);

  // --- Members ---
  await prisma.member.create({
    data: {
      id: "member_1",
      organizationId: "org_demo_1",
      userId: "user_demo_1",
      role: "owner",
      createdAt: now,
    },
  });
  await prisma.member.create({
    data: {
      id: "member_2",
      organizationId: "org_demo_1",
      userId: "user_demo_2",
      role: "member",
      createdAt: now,
    },
  });
  console.log("  Created 2 members");

  // --- Sites ---
  const sites = [];
  for (const site of DEMO_SITES) {
    const created = await prisma.site.create({
      data: {
        organizationId: "org_demo_1",
        domain: site.domain,
      },
    });
    sites.push(created);
  }
  console.log(`  Created ${sites.length} sites`);

  // --- Scans ---
  let scanCount = 0;
  let scoreCount = 0;
  let recCount = 0;

  for (const site of sites) {
    // Each site gets 2-4 scans
    const numScans = randomScore(2, 4);

    for (let i = 0; i < numScans; i++) {
      const daysAgo = randomScore(0, 30);
      const scanDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const overallScore = randomScore(25, 95);
      const status = pick(["completed", "completed", "completed", "completed", "failed"]);

      const scan = await prisma.scan.create({
        data: {
          siteId: site.id,
          status,
          overallScore: status === "completed" ? overallScore : null,
          createdAt: scanDate,
          completedAt: status === "completed" ? new Date(scanDate.getTime() + randomScore(5000, 30000)) : null,
        },
      });
      scanCount++;

      if (status !== "completed") continue;

      // --- Category Scores ---
      const categoryScores = CATEGORIES.map((category) => ({
        scanId: scan.id,
        category,
        score: Math.max(0, Math.min(100, overallScore + randomScore(-30, 30))),
        details: generateCategoryDetails(category),
      }));

      await prisma.categoryScore.createMany({ data: categoryScores });
      scoreCount += categoryScores.length;

      // --- Recommendations ---
      const numRecs = randomScore(3, 7);
      const severityPool: Array<{ severity: string; recs: typeof CRITICAL_RECS }> = [
        { severity: "critical", recs: CRITICAL_RECS },
        { severity: "warning", recs: WARNING_RECS },
        { severity: "info", recs: INFO_RECS },
      ];

      const recommendations = [];
      for (const { severity, recs } of severityPool) {
        const count = severity === "critical" ? randomScore(0, 2) : severity === "warning" ? randomScore(1, 3) : randomScore(0, 2);
        const picked = pickN(recs, Math.min(count, recs.length));
        for (const rec of picked) {
          recommendations.push({
            scanId: scan.id,
            severity,
            title: rec.title,
            description: rec.description,
            fixSnippet: severity === "critical" ? generateFixSnippet(rec.title) : null,
          });
        }
      }

      if (recommendations.length > 0) {
        await prisma.recommendation.createMany({ data: recommendations.slice(0, numRecs) });
        recCount += Math.min(recommendations.length, numRecs);
      }
    }
  }

  console.log(`  Created ${scanCount} scans`);
  console.log(`  Created ${scoreCount} category scores`);
  console.log(`  Created ${recCount} recommendations`);
  console.log("\nSeed complete!");
}

// ---------------------------------------------------------------------------
// Detail generators
// ---------------------------------------------------------------------------

function generateCategoryDetails(category: string): Record<string, unknown> {
  switch (category) {
    case "structure":
      return {
        hasSchemaOrg: Math.random() > 0.5,
        altTextCoverage: Math.random() * 0.5 + 0.5,
        semanticHtmlRatio: Math.random() * 0.5 + 0.3,
        headingCount: randomScore(3, 15),
        maxHeadingLevel: randomScore(3, 6),
        internalLinks: randomScore(2, 20),
        externalLinks: randomScore(0, 10),
        imagesTotal: randomScore(3, 25),
        imagesWithAlt: randomScore(2, 20),
      };
    case "accessibility":
      return {
        missingAltText: randomScore(0, 12),
        formLabelsPresent: Math.random() > 0.3,
        skipNavLinks: Math.random() > 0.5,
        ariaLandmarks: randomScore(0, 8),
        colorContrastIssues: randomScore(0, 5),
      };
    case "semantic":
      return {
        hasSemanticTags: Math.random() > 0.4,
        mainContentIdentified: Math.random() > 0.3,
        usesArticle: Math.random() > 0.5,
        usesNav: Math.random() > 0.4,
        usesSection: Math.random() > 0.4,
        usesAside: Math.random() > 0.6,
        usesFooter: Math.random() > 0.5,
        usesHeader: Math.random() > 0.5,
      };
    case "crawlability":
      return {
        robotsTxtAllowsAi: Math.random() > 0.4,
        hasLlmsTxt: Math.random() > 0.6,
        requiresJsRendering: Math.random() > 0.6,
        hasSitemap: Math.random() > 0.3,
        robotsTxtDirectives: randomScore(2, 8),
      };
    case "structured_data":
      return {
        hasJsonLd: Math.random() > 0.5,
        hasMicrodata: Math.random() > 0.7,
        hasOpenGraph: Math.random() > 0.3,
        hasTwitterCards: Math.random() > 0.5,
        schemasFound: randomScore(0, 4),
      };
    default:
      return {};
  }
}

function generateFixSnippet(title: string): string | null {
  if (title.includes("robots.txt")) {
    return `User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nSitemap: https://yoursite.com/sitemap.xml`;
  }
  if (title.includes("JSON-LD")) {
    return `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "name": "Your Site Name",\n  "url": "https://yoursite.com"\n}\n</script>`;
  }
  if (title.includes("alt text")) {
    return `<img src="photo.jpg" alt="Descriptive text about this image" />`;
  }
  if (title.includes("server-side rendering")) {
    return `// Ensure content is rendered server-side, not via client-side JavaScript\n// Use SSR or static generation instead of client-only rendering`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
