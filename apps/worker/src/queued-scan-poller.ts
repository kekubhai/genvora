import { Client, Connection } from "@temporalio/client";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { TASK_QUEUES, type AuditWorkflowInput } from "@repo/shared-types";

const POLL_MS = Number(process.env["SCAN_POLL_INTERVAL_MS"] ?? 5000);

async function persistWorkflowResult(
  prisma: PrismaClient,
  scanId: string,
  handle: { result: () => Promise<any>; workflowId: string },
): Promise<void> {
  try {
    const result = await handle.result();
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: "completed",
        overallScore: result?.overallScore ?? null,
        completedAt: new Date(),
      },
    });

    await prisma.categoryScore.deleteMany({ where: { scanId } });
    await prisma.recommendation.deleteMany({ where: { scanId } });

    const scores = result?.categoryScores ?? {};
    for (const [category, score] of Object.entries(scores)) {
      const numeric = typeof score === "number" ? score : Number(score);
      if (!Number.isFinite(numeric)) continue;
      await prisma.categoryScore.create({
        data: {
          scanId,
          category,
          score: Math.round(numeric),
          details: {},
        },
      });
    }

    for (const rec of result?.recommendations ?? []) {
      await prisma.recommendation.create({
        data: {
          scanId,
          severity: rec.severity ?? "info",
          title: rec.title ?? "Finding",
          description: rec.description ?? "",
          fixSnippet: rec.fixSnippet ?? null,
        },
      });
    }

    console.log(
      JSON.stringify({
        level: "info",
        message: "Scan report persisted",
        scanId,
        workflowId: handle.workflowId,
        overallScore: result?.overallScore ?? null,
        recommendations: (result?.recommendations ?? []).length,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (err) {
    console.error("AuditWorkflow failed:", err);
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "failed" },
    });
  }
}

function createPrisma() {
  const connectionString = process.env["DATABASE_URL"] ?? "";
  // Prefer direct URL when available (pooler can break long worker sessions)
  const url = process.env["DIRECT_DATABASE_URL"] || connectionString;
  const pool = new Pool({ connectionString: url, max: 2 });
  return new PrismaClient({ adapter: new PrismaPg(pool) as any });
}

/**
 * Polls Supabase/Postgres for scans left in `queued` by the Cloudflare API,
 * then starts AuditWorkflow on local Temporal so activities emit OTEL spans to SigNoz.
 */
export function startQueuedScanPoller(temporalAddress: string): void {
  const prisma = createPrisma();
  let clientPromise: Promise<Client> | null = null;
  let busy = false;

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const connection = await Connection.connect({ address: temporalAddress });
        return new Client({ connection });
      })().catch((err) => {
        clientPromise = null;
        throw err;
      });
    }
    return clientPromise;
  }

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const queued = await prisma.scan.findMany({
        where: { status: "queued" },
        include: { site: { select: { id: true, domain: true } } },
        orderBy: { createdAt: "asc" },
        take: 3,
      });

      if (queued.length === 0) return;

      const client = await getClient();

      for (const scan of queued) {
        const domain = scan.site?.domain;
        if (!domain) {
          await prisma.scan.update({
            where: { id: scan.id },
            data: { status: "failed" },
          });
          continue;
        }

        const url = `https://${domain}`;
        const input: AuditWorkflowInput = {
          siteId: scan.siteId,
          url,
        };

        // Claim the scan before starting workflow to avoid double-dispatch
        await prisma.scan.update({
          where: { id: scan.id },
          data: { status: "running" },
        });

        try {
          // Unique workflow id per attempt — reuse of audit-${scanId} blocked retries
          // when an old timed-out execution was still open in Temporal.
          const workflowId = `audit-${scan.id}-${Date.now()}`;
          const handle = await client.workflow.start("AuditWorkflow", {
            taskQueue: TASK_QUEUES.AUDIT,
            workflowId,
            args: [input],
          });

          console.log(
            JSON.stringify({
              level: "info",
              message: "Started AuditWorkflow for queued scan",
              scanId: scan.id,
              workflowId: handle.workflowId,
              url,
              timestamp: new Date().toISOString(),
            }),
          );

          // Persist results when workflow finishes (don't block the poll loop)
          void persistWorkflowResult(prisma, scan.id, handle);
        } catch (err) {
          console.error("Failed to start workflow:", err);
          await prisma.scan.update({
            where: { id: scan.id },
            data: { status: "queued" }, // release claim for retry
          });
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Queued scan poller tick failed",
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        }),
      );
    } finally {
      busy = false;
    }
  }

  console.log(
    JSON.stringify({
      level: "info",
      message: "Queued scan poller started — bridging Cloudflare API → Temporal → SigNoz",
      intervalMs: POLL_MS,
      timestamp: new Date().toISOString(),
    }),
  );

  void tick();
  setInterval(() => void tick(), POLL_MS);
}
