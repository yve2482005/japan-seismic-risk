import { publicProcedure, router } from "../_core/trpc";
import { listModelReports } from "../seismic/modelReports";
import { getLiveSnapshot } from "../seismic/liveSnapshot";

export const seismicRouter = router({
  snapshot: publicProcedure.query(async () => getLiveSnapshot()),
  modelReports: publicProcedure.query(async () => ({
    mode: "registry" as const,
    reports: await listModelReports(),
  })),
});
