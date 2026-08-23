import { and, eq } from "drizzle-orm";
import { modelVersions } from "../../drizzle/schema";
import { getDb } from "../db";
import { decideModelPromotion, type EvaluationMetrics, type PromotionGate, type VersionedModel } from "./evaluation";

type StoredVersion = typeof modelVersions.$inferSelect;

function evaluationFromStored(version: StoredVersion): EvaluationMetrics {
  const metadata = version.metricsJson ? JSON.parse(version.metricsJson) as Partial<EvaluationMetrics> : {};
  return {
    accuracy: version.accuracy ?? 0,
    precision: version.precision,
    recall: version.recall,
    f1: version.f1,
    falsePositiveRate: metadata.falsePositiveRate ?? null,
    falseNegativeRate: metadata.falseNegativeRate ?? null,
    brierScore: version.brierScore ?? Number.POSITIVE_INFINITY,
    calibration: metadata.calibration ?? { expectedCalibrationError: Number.POSITIVE_INFINITY, bins: [] },
    confusion: metadata.confusion ?? { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 },
  };
}

function versionedModel(version: StoredVersion): VersionedModel {
  return { id: version.id, modelVersion: version.modelVersion, status: version.status, metrics: evaluationFromStored(version) };
}

/** Persists only the result of a prior chronological evaluation; it never calculates a score itself. */
export async function promoteStoredCandidate(candidateId: number, gate: PromotionGate) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const candidate = (await db.select().from(modelVersions).where(and(eq(modelVersions.id, candidateId), eq(modelVersions.status, "candidate"))).limit(1))[0];
  if (!candidate) throw new Error("Candidate model was not found.");
  const production = (await db.select().from(modelVersions).where(eq(modelVersions.status, "production")).limit(1))[0] ?? null;
  const decision = decideModelPromotion(versionedModel(candidate), production ? versionedModel(production) : null, gate);
  if (!decision.eligible) return decision;
  await db.transaction(async tx => {
    if (production) await tx.update(modelVersions).set({ status: "retired" }).where(eq(modelVersions.id, production.id));
    await tx.update(modelVersions).set({ status: "production" }).where(eq(modelVersions.id, candidate.id));
  });
  return decision;
}
