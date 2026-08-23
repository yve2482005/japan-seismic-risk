import { desc, eq } from "drizzle-orm";
import { modelVersions } from "../../drizzle/schema";
import { getDb } from "../db";
import type { EvaluationMetrics } from "./evaluation";

export type PersistedEvaluation = EvaluationMetrics & { rocAuc?: number | null; prAuc?: number | null };

export type EvaluatedCandidateInput = {
  modelVersion: string;
  targetDefinition: string;
  algorithm: "logistic_regression" | "random_forest" | "gradient_boosting";
  datasetVersion: string;
  featureVersion: string;
  trainingRecords: number;
  testRecords: number;
  metrics: PersistedEvaluation;
};

/**
 * Stores evaluation output produced by the offline, chronological trainer.
 * This function intentionally persists a candidate; promotion remains a
 * separate quality-gated operation in modelRegistry.ts.
 */
export async function persistEvaluatedCandidate(input: EvaluatedCandidateInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const result = await db.insert(modelVersions).values({
    modelVersion: input.modelVersion,
    targetDefinition: input.targetDefinition,
    algorithm: input.algorithm,
    status: "candidate",
    datasetVersion: input.datasetVersion,
    featureVersion: input.featureVersion,
    trainingRecords: input.trainingRecords,
    testRecords: input.testRecords,
    accuracy: input.metrics.accuracy,
    precision: input.metrics.precision,
    recall: input.metrics.recall,
    f1: input.metrics.f1,
    rocAuc: input.metrics.rocAuc ?? null,
    prAuc: input.metrics.prAuc ?? null,
    brierScore: input.metrics.brierScore,
    metricsJson: JSON.stringify({
      falsePositiveRate: input.metrics.falsePositiveRate,
      falseNegativeRate: input.metrics.falseNegativeRate,
      calibration: input.metrics.calibration,
      confusion: input.metrics.confusion,
    }),
  });
  return { id: Number(result[0].insertId), status: "candidate" as const };
}

export async function listModelReports(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelVersions).orderBy(desc(modelVersions.trainedAt)).limit(limit);
}

export async function getModelReport(modelVersion: string) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(modelVersions).where(eq(modelVersions.modelVersion, modelVersion)).limit(1))[0] ?? null;
}
