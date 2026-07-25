/**
 * Shared Prisma client for Cloudflare Worker handlers (auth + sites/scans).
 * One Pool only — Supabase direct connections are scarce; a second Pool hangs.
 */

let prisma: any = null;
let prismaInit: Promise<any> | null = null;

function isCloudflareWorker(): boolean {
  const g = globalThis as Record<string, unknown>;
  return (
    typeof g["WebSocketPair"] === "function" ||
    typeof g["caches"] !== "undefined" ||
    typeof globalThis.navigator !== "undefined"
  );
}

export async function getSharedPrisma() {
  if (prisma) return prisma;

  if (!prismaInit) {
    prismaInit = (async () => {
      if (isCloudflareWorker()) {
        const { PrismaClient } = await import("@prisma/client");
        const { PrismaPg } = await import("@prisma/adapter-pg");
        const { Pool } = await import("pg");
        const pool = new Pool({
          connectionString: process.env["DATABASE_URL"] ?? "",
          max: 1,
          connectionTimeoutMillis: 8_000,
          idleTimeoutMillis: 10_000,
          allowExitOnIdle: true,
        });
        prisma = new PrismaClient({
          adapter: new PrismaPg(pool) as any,
          log: ["error"],
        });
      } else {
        const { PrismaClient } = await import("@prisma/client");
        prisma = new PrismaClient({ log: ["error"] });
        await prisma.$connect();
      }
      return prisma;
    })().catch((err) => {
      prismaInit = null;
      throw err;
    });
  }

  return prismaInit;
}
