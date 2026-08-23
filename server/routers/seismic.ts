import { DEMO_EVENTS, DEMO_REGIONS } from "@shared/seismic";
import { publicProcedure, router } from "../_core/trpc";
import { listModelReports } from "../seismic/modelReports";

export const seismicRouter = router({
  snapshot: publicProcedure.query(() => ({
    mode: "demo" as const,
    generatedAt: "2026-08-23T08:00:00Z",
    collection: {
      status: "disabled_pending_compliance_review" as const,
      source: "JMA Seismological Bulletin candidate",
      lastSuccess: null,
      nextRun: null,
      recordsAccepted: 0,
      duplicatesRejected: 0,
      invalidRejected: 0,
    },
    model: {
      status: "demo_only" as const,
      version: "DEMO-0.1.0",
      target: "M4+ in the next 24 hours",
      accuracy: null,
      precision: null,
      recall: null,
      prAuc: null,
      calibration: "Not assessed: a verified historical dataset is required.",
    },
    events: DEMO_EVENTS,
    regions: DEMO_REGIONS,
  })),
  modelReports: publicProcedure.query(async () => ({
    mode: "registry" as const,
    reports: await listModelReports(),
  })),
});
