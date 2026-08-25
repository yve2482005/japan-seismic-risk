import { desc } from "drizzle-orm";
import { collectionTelemetry } from "../drizzle/schema";
import { getDb } from "./db";

export type WorkflowCollectionTelemetry = { runId: string; status: "success" | "failure"; retryAttempts: number };

export async function recordCollectionTelemetry(input: WorkflowCollectionTelemetry) {
  const db = await getDb();
  if (!db) throw new Error("Collection telemetry storage is unavailable.");
  await db.insert(collectionTelemetry).values({ workflowRunId: input.runId, status: input.status, retryAttempts: input.retryAttempts }).onDuplicateKeyUpdate({ set: { status: input.status, retryAttempts: input.retryAttempts } });
}

export async function recentCollectionReliability(limit = 30) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(collectionTelemetry).orderBy(desc(collectionTelemetry.reportedAt)).limit(limit);
  if (!rows.length) return null;
  const successes = rows.filter(row => row.status === "success").length;
  return {
    windowRuns: rows.length,
    successes,
    failures: rows.length - successes,
    successRatePercent: Number(((successes / rows.length) * 100).toFixed(1)),
    retryAttempts: rows.reduce((total, row) => total + row.retryAttempts, 0),
    latestStatus: rows[0]!.status,
    latestReportedAt: rows[0]!.reportedAt.toISOString(),
  };
}
