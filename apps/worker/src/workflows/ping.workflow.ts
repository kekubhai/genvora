// Temporal Workflow — must only import from @temporalio/workflow
// No Node.js APIs or external imports are allowed inside workflow files.

import { defineSignal } from "@temporalio/workflow";

// Signal definitions (placeholder for future use)
export const cancelSignal = defineSignal("cancel");

/**
 * PingWorkflow — validates the Temporal pipeline end-to-end.
 * Registered on task queue: ping-task-queue
 * Returns: "pong"
 */
export async function PingWorkflow(): Promise<string> {
  return "pong";
}
