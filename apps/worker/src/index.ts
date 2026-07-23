// OpenTelemetry MUST be initialized before any other imports
import { initTracer } from "@repo/observability";
initTracer("genvora-worker");

import { NativeConnection, Worker } from "@temporalio/worker";
import { TASK_QUEUES } from "@repo/shared-types";
import { validateEnv } from "./env.validation";
import * as activities from "./activities/audit.activities";

async function main() {
  // Validate required env vars — exit with non-zero if missing
  validateEnv();

  const temporalAddress = process.env["TEMPORAL_ADDRESS"] ?? "localhost:7233";

  let connection: NativeConnection;

  try {
    connection = await NativeConnection.connect({
      address: temporalAddress,
    });
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        level: "error",
        message: "Temporal server unreachable — worker cannot start",
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      }) + "\n",
    );
    process.exit(1);
  }

  // Create worker for audit task queue
  const auditWorker = await Worker.create({
    connection,
    namespace: "default",
    taskQueue: TASK_QUEUES.AUDIT,
    // Workflows directory — Temporal bundles these separately
    workflowsPath: require.resolve("./workflows/audit.workflow"),
    activities: {
      fetchPageActivity: activities.fetchPageActivity,
      parseStructureActivity: activities.parseStructureActivity,
      checkCrawlabilityActivity: activities.checkCrawlabilityActivity,
      analyzeAccessibilityActivity: activities.analyzeAccessibilityActivity,
      analyzeSemanticActivity: activities.analyzeSemanticActivity,
      analyzeStructuredDataActivity: activities.analyzeStructuredDataActivity,
      scoreActivity: activities.scoreActivity,
      generateRecommendationsActivity: activities.generateRecommendationsActivity,
      storeSnapshotActivity: activities.storeSnapshotActivity,
    },
  });

  console.log(
    JSON.stringify({
      level: "info",
      message: "Connected to Temporal",
      address: temporalAddress,
      taskQueue: TASK_QUEUES.AUDIT,
      timestamp: new Date().toISOString(),
    }),
  );

  await auditWorker.run();
}

main().catch((err: unknown) => {
  process.stderr.write(
    JSON.stringify({
      level: "error",
      message: "Worker fatal error",
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    }) + "\n",
  );
  process.exit(1);
});
