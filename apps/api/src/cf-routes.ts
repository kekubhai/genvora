/**
 * Sites/scans via Supabase PostgREST — no pg TCP (avoids Worker hangs).
 * Falls back to shared Prisma if Supabase env is missing.
 */

import { getSharedPrisma } from "./shared-prisma";

const DEMO_ORG_ID = "org_demo_1";

type Cors = Record<string, string>;

function json(data: unknown, status = 200, cors: Cors = {}): Response {
  return Response.json(data, { status, headers: cors });
}

function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  try {
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./, "")
      .split("/")[0]!
      .split("?")[0]!;
  }
}

function supabaseConfig() {
  const base = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!base || !key) return null;
  return { base, key };
}

async function sb(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<Response> {
  const cfg = supabaseConfig()!;
  const headers = new Headers(init.headers);
  headers.set("apikey", cfg.key);
  headers.set("Authorization", `Bearer ${cfg.key}`);
  headers.set("Content-Type", "application/json");
  if (init.prefer) headers.set("Prefer", init.prefer);

  return fetch(`${cfg.base}/rest/v1${path}`, { ...init, headers });
}

function cuidLike(): string {
  // compact unique id for inserts when DB default isn't applied via REST
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Map PostgREST snake_case embeds to the camelCase shape the web app expects. */
function shapeScan(row: any) {
  if (!row || typeof row !== "object") return row;
  const {
    category_score,
    recommendation,
    site,
    ...rest
  } = row;
  return {
    ...rest,
    categoryScores: Array.isArray(category_score) ? category_score : [],
    recommendations: Array.isArray(recommendation) ? recommendation : [],
    site: Array.isArray(site) ? (site[0] ?? null) : (site ?? null),
  };
}

async function ensureDemoOrgRest(): Promise<string> {
  const existing = await sb(`/organization?id=eq.${DEMO_ORG_ID}&select=id`);
  const rows = (await existing.json()) as Array<{ id: string }>;
  if (rows[0]?.id) return rows[0].id;

  const created = await sb(`/organization`, {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({
      id: DEMO_ORG_ID,
      name: "Genvora Demo",
      slug: "genvora-demo",
      createdAt: new Date().toISOString(),
    }),
  });
  if (!created.ok) {
    // race: another request created it
    return DEMO_ORG_ID;
  }
  return DEMO_ORG_ID;
}

async function handleWithSupabase(
  request: Request,
  cors: Cors,
  pathname: string,
  method: string,
): Promise<Response | null> {
  // GET /scans/:id
  const scanMatch = pathname.match(/^\/scans\/([^/]+)(?:\/(snapshot))?$/);
  if (scanMatch) {
    if (method !== "GET") return json({ error: "Method not allowed" }, 405, cors);
    const scanId = decodeURIComponent(scanMatch[1]!);
    const isSnapshot = scanMatch[2] === "snapshot";

    if (isSnapshot) {
      const res = await sb(
        `/scan?id=eq.${encodeURIComponent(scanId)}&select=rawHtmlUrl,screenshotUrl`,
      );
      if (!res.ok) return json({ error: await res.text() }, 500, cors);
      const rows = (await res.json()) as any[];
      if (!rows[0]) return json({ error: "Scan not found or no snapshots available" }, 404, cors);
      return json(rows[0], 200, cors);
    }

    // PostgREST uses @@map table names, not Prisma relation names
    const res = await sb(
      `/scan?id=eq.${encodeURIComponent(scanId)}&select=*,category_score(*),recommendation(*),site(id,domain)`,
    );
    if (!res.ok) return json({ error: await res.text() }, 500, cors);
    const rows = (await res.json()) as any[];
    if (!rows[0]) return json({ error: "Scan not found" }, 404, cors);
    return json(shapeScan(rows[0]), 200, cors);
  }

  if (!(pathname === "/sites" || pathname.startsWith("/sites/"))) return null;

  // GET /sites
  if (pathname === "/sites" && method === "GET") {
    const res = await sb(
      `/site?select=id,organizationId,domain,createdAt,scans:scan(id,status,overallScore,createdAt,completedAt)&order=createdAt.desc`,
    );
    if (!res.ok) {
      return json({ error: await res.text() }, 500, cors);
    }
    const sites = (await res.json()) as any[];
    // keep only latest scan per site + add _count
    const shaped = sites.map((site) => {
      const scans = Array.isArray(site.scans)
        ? [...site.scans].sort(
            (a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt),
          )
        : [];
      return {
        id: site.id,
        organizationId: site.organizationId,
        domain: site.domain,
        createdAt: site.createdAt,
        scans: scans.slice(0, 1),
        _count: { scans: scans.length },
      };
    });
    return json(shaped, 200, cors);
  }

  // POST /sites
  if (pathname === "/sites" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as {
      domain?: string;
      url?: string;
      organizationId?: string;
    };
    const domainOrUrl = body.domain ?? body.url;
    if (!domainOrUrl) return json({ error: "domain or url is required" }, 400, cors);

    const domain = normalizeDomain(domainOrUrl);
    const existingRes = await sb(`/site?domain=eq.${encodeURIComponent(domain)}&select=*`);
    const existing = (await existingRes.json()) as any[];
    if (existing[0]) return json(existing[0], 201, cors);

    const organizationId = body.organizationId
      ? body.organizationId
      : await ensureDemoOrgRest();

    const insert = await sb(`/site`, {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        id: cuidLike(),
        domain,
        organizationId,
        createdAt: new Date().toISOString(),
      }),
    });
    if (!insert.ok) {
      return json({ error: await insert.text() }, 500, cors);
    }
    const created = (await insert.json()) as any[];
    return json(created[0] ?? { domain, organizationId }, 201, cors);
  }

  const siteMatch = pathname.match(/^\/sites\/([^/]+)(?:\/(scans))?$/);
  if (!siteMatch) return json({ error: "Not found" }, 404, cors);

  const siteId = decodeURIComponent(siteMatch[1]!);
  const isScans = siteMatch[2] === "scans";

  if (!isScans) {
    if (method !== "GET") return json({ error: "Method not allowed" }, 405, cors);
    const res = await sb(
      `/site?id=eq.${encodeURIComponent(siteId)}&select=*,scans:scan(*,category_score(*),recommendation(*))`,
    );
    if (!res.ok) return json({ error: await res.text() }, 500, cors);
    const rows = (await res.json()) as any[];
    if (!rows[0]) return json({ error: "Site not found" }, 404, cors);
    const site = rows[0];
    site.scans = Array.isArray(site.scans) ? site.scans.map(shapeScan) : [];
    return json(site, 200, cors);
  }

  if (method === "GET") {
    const res = await sb(
      `/scan?siteId=eq.${encodeURIComponent(siteId)}&select=*,category_score(*),recommendation(*)&order=createdAt.desc`,
    );
    if (!res.ok) return json({ error: await res.text() }, 500, cors);
    const rows = (await res.json()) as any[];
    return json(rows.map(shapeScan), 200, cors);
  }

  if (method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { url?: string };
    if (!body.url) return json({ error: "URL is required" }, 400, cors);

    const siteRes = await sb(`/site?id=eq.${encodeURIComponent(siteId)}&select=id`);
    const sites = (await siteRes.json()) as any[];
    if (!sites[0]) return json({ error: `Site not found: ${siteId}` }, 404, cors);

    const insert = await sb(`/scan`, {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        id: cuidLike(),
        siteId,
        status: "queued",
        createdAt: new Date().toISOString(),
      }),
    });
    if (!insert.ok) return json({ error: await insert.text() }, 500, cors);
    const created = (await insert.json()) as any[];
    return json(created[0], 201, cors);
  }

  return json({ error: "Method not allowed" }, 405, cors);
}

async function handleWithPrisma(
  request: Request,
  cors: Cors,
  pathname: string,
  method: string,
): Promise<Response | null> {
  const client = await getSharedPrisma();

  const scanMatch = pathname.match(/^\/scans\/([^/]+)(?:\/(snapshot))?$/);
  if (scanMatch) {
    const scanId = decodeURIComponent(scanMatch[1]!);
    const isSnapshot = scanMatch[2] === "snapshot";
    if (method !== "GET") return json({ error: "Method not allowed" }, 405, cors);

    if (isSnapshot) {
      const scan = await client.scan.findUnique({
        where: { id: scanId },
        select: { rawHtmlUrl: true, screenshotUrl: true },
      });
      if (!scan) return json({ error: "Scan not found or no snapshots available" }, 404, cors);
      return json(scan, 200, cors);
    }

    const scan = await client.scan.findUnique({
      where: { id: scanId },
      include: {
        categoryScores: true,
        recommendations: true,
        site: { select: { id: true, domain: true } },
      },
    });
    if (!scan) return json({ error: "Scan not found" }, 404, cors);
    return json(scan, 200, cors);
  }

  if (!(pathname === "/sites" || pathname.startsWith("/sites/"))) return null;

  if (pathname === "/sites" && method === "GET") {
    const sites = await client.site.findMany({
      include: {
        scans: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            overallScore: true,
            createdAt: true,
            completedAt: true,
          },
        },
        _count: { select: { scans: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return json(sites, 200, cors);
  }

  if (pathname === "/sites" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as {
      domain?: string;
      url?: string;
      organizationId?: string;
    };
    const domainOrUrl = body.domain ?? body.url;
    if (!domainOrUrl) return json({ error: "domain or url is required" }, 400, cors);

    const domain = normalizeDomain(domainOrUrl);
    const existing = await client.site.findUnique({ where: { domain } });
    if (existing) return json(existing, 201, cors);

    let organizationId = body.organizationId;
    if (organizationId) {
      const org = await client.organization.findUnique({ where: { id: organizationId } });
      if (!org) organizationId = undefined;
    }
    if (!organizationId) {
      const demo = await client.organization.findUnique({ where: { id: DEMO_ORG_ID } });
      if (demo) {
        organizationId = demo.id;
      } else {
        const created = await client.organization.create({
          data: {
            id: DEMO_ORG_ID,
            name: "Genvora Demo",
            slug: "genvora-demo",
            createdAt: new Date(),
          },
        });
        organizationId = created.id;
      }
    }

    const site = await client.site.create({
      data: { domain, organizationId },
    });
    return json(site, 201, cors);
  }

  const siteMatch = pathname.match(/^\/sites\/([^/]+)(?:\/(scans))?$/);
  if (!siteMatch) return json({ error: "Not found" }, 404, cors);

  const siteId = decodeURIComponent(siteMatch[1]!);
  const isScans = siteMatch[2] === "scans";

  if (!isScans) {
    if (method !== "GET") return json({ error: "Method not allowed" }, 405, cors);
    const site = await client.site.findUnique({
      where: { id: siteId },
      include: {
        scans: {
          orderBy: { createdAt: "desc" },
          include: { categoryScores: true, recommendations: true },
        },
      },
    });
    if (!site) return json({ error: "Site not found" }, 404, cors);
    return json(site, 200, cors);
  }

  if (method === "GET") {
    const scans = await client.scan.findMany({
      where: { siteId },
      include: { categoryScores: true, recommendations: true },
      orderBy: { createdAt: "desc" },
    });
    return json(scans, 200, cors);
  }

  if (method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { url?: string };
    if (!body.url) return json({ error: "URL is required" }, 400, cors);

    const site = await client.site.findUnique({ where: { id: siteId } });
    if (!site) return json({ error: `Site not found: ${siteId}` }, 404, cors);

    const scan = await client.scan.create({
      data: { siteId, status: "queued" },
    });
    return json(scan, 201, cors);
  }

  return json({ error: "Method not allowed" }, 405, cors);
}

export async function handleSitesAndScans(
  request: Request,
  cors: Cors,
): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method.toUpperCase();

  const isSitesOrScans =
    pathname === "/sites" ||
    pathname.startsWith("/sites/") ||
    pathname.startsWith("/scans/");

  if (!isSitesOrScans) return null;

  try {
    if (supabaseConfig()) {
      return await handleWithSupabase(request, cors, pathname, method);
    }
    return await handleWithPrisma(request, cors, pathname, method);
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      500,
      cors,
    );
  }
}
