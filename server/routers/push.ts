import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { disableSubscription, saveSubscription, userPushStatus, vapidConfiguration } from "../pushSubscriptions";

const preferences = z.object({ minimumMagnitude: z.union([z.literal(4), z.literal(5), z.literal(6)]), regions: z.array(z.string()).min(1).max(9) });
const subscription = z.object({ endpoint: z.string().url().max(4096), keys: z.object({ p256dh: z.string().min(16).max(1024), auth: z.string().min(8).max(1024) }) });

export const pushRouter = router({
  configuration: protectedProcedure.query(async () => ({ publicKey: (await vapidConfiguration()).publicKey })),
  status: protectedProcedure.query(({ ctx }) => userPushStatus(ctx.user.id)),
  subscribe: protectedProcedure.input(z.object({ subscription, preferences })).mutation(({ ctx, input }) => saveSubscription(ctx.user.id, input.subscription, input.preferences)),
  unsubscribe: protectedProcedure.input(z.object({ endpoint: z.string().url().max(4096) })).mutation(({ ctx, input }) => disableSubscription(ctx.user.id, input.endpoint)),
});
