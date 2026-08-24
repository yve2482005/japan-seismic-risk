import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { pushConfiguration, pushDeliveries, pushSubscriptions } from "../drizzle/schema";
import { getDb } from "./db";

export type SubscriptionPreferences = { minimumMagnitude: 4 | 5 | 6; regions: string[] };
export type BrowserPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export const USGS_ALERT_SOURCE_PREFIX = "U.S. Geological Survey (USGS)";
export const MAX_PUSH_ALERT_AGE_MS = 24 * 60 * 60 * 1000;

function encryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Server encryption secret is unavailable.");
  return createHash("sha256").update(secret).digest();
}

function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
}

function unseal(value: string) {
  const [ivEncoded, tagEncoded, bodyEncoded] = value.split(".");
  if (!ivEncoded || !tagEncoded || !bodyEncoded) throw new Error("Invalid sealed push configuration.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(bodyEncoded, "base64url")), decipher.final()]).toString("utf8");
}

export function endpointHash(endpoint: string) { return createHash("sha256").update(endpoint).digest("hex"); }
export function validSubscription(subscription: BrowserPushSubscription) { return Boolean(subscription.endpoint?.startsWith("https://") && subscription.keys?.p256dh && subscription.keys?.auth); }
export function isCanonicalUsgsAlertSource(source: string) { return source.trim().startsWith(USGS_ALERT_SOURCE_PREFIX); }

export async function vapidConfiguration() {
  const db = await getDb();
  if (!db) throw new Error("Private push storage is unavailable.");
  const existing = (await db.select().from(pushConfiguration).where(eq(pushConfiguration.id, 1)).limit(1))[0];
  if (existing) return { publicKey: existing.publicKey, privateKey: unseal(existing.sealedPrivateKey) };
  const pair = webpush.generateVAPIDKeys();
  try {
    await db.insert(pushConfiguration).values({ id: 1, publicKey: pair.publicKey, sealedPrivateKey: seal(pair.privateKey) });
    return pair;
  } catch {
    const created = (await db.select().from(pushConfiguration).where(eq(pushConfiguration.id, 1)).limit(1))[0];
    if (!created) throw new Error("Unable to initialize push configuration.");
    return { publicKey: created.publicKey, privateKey: unseal(created.sealedPrivateKey) };
  }
}

export async function saveSubscription(userId: number, subscription: BrowserPushSubscription, preferences: SubscriptionPreferences) {
  if (!validSubscription(subscription)) throw new Error("Invalid browser push subscription.");
  const db = await getDb();
  if (!db) throw new Error("Private push storage is unavailable.");
  const hash = endpointHash(subscription.endpoint);
  const values = { userId, endpointHash: hash, subscriptionJson: JSON.stringify(subscription), minimumMagnitude: preferences.minimumMagnitude, regionsJson: JSON.stringify(preferences.regions), enabled: true, failureCount: 0, activatedAt: new Date() };
  const existing = (await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpointHash, hash)).limit(1))[0];
  if (existing) {
    await db.update(pushSubscriptions).set(values).where(eq(pushSubscriptions.id, existing.id));
    return { id: existing.id, enabled: true };
  }
  const result = await db.insert(pushSubscriptions).values(values);
  return { id: Number(result[0].insertId), enabled: true };
}

export async function userPushStatus(userId: number) {
  const db = await getDb();
  if (!db) return { enabled: false, subscriptions: 0 };
  const subscriptions = await db.select({ id: pushSubscriptions.id, enabled: pushSubscriptions.enabled, minimumMagnitude: pushSubscriptions.minimumMagnitude, regionsJson: pushSubscriptions.regionsJson }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  return { enabled: subscriptions.some(subscription => subscription.enabled), subscriptions: subscriptions.map(subscription => ({ id: subscription.id, enabled: subscription.enabled, minimumMagnitude: subscription.minimumMagnitude, regions: safelyParseRegions(subscription.regionsJson) })) };
}

export async function disableSubscription(userId: number, endpoint: string) {
  const db = await getDb();
  if (!db) return { disabled: false };
  const hash = endpointHash(endpoint);
  const subscription = (await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpointHash, hash)).limit(1))[0];
  if (!subscription || subscription.userId !== userId) return { disabled: false };
  await db.update(pushSubscriptions).set({ enabled: false }).where(eq(pushSubscriptions.id, subscription.id));
  return { disabled: true };
}

function safelyParseRegions(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []; } catch { return []; } }
export function subscriptionMatchesAlert(subscription: { enabled: boolean; minimumMagnitude: number; regionsJson: string }, alert: { source: string; eventMagnitude: number; region: string }) { return subscription.enabled && isCanonicalUsgsAlertSource(alert.source) && alert.eventMagnitude >= subscription.minimumMagnitude && safelyParseRegions(subscription.regionsJson).includes(alert.region); }
export function subscriptionCanReceiveAlert(subscription: { enabled: boolean; minimumMagnitude: number; regionsJson: string; activatedAt: Date }, alert: { source: string; eventMagnitude: number; region: string; detectedAt: string }, now = new Date()) {
  if (!subscriptionMatchesAlert(subscription, alert)) return false;
  const detectedAt = new Date(alert.detectedAt);
  const detectedMs = detectedAt.getTime();
  return Number.isFinite(detectedMs) && detectedMs >= subscription.activatedAt.getTime() && detectedMs <= now.getTime() && now.getTime() - detectedMs <= MAX_PUSH_ALERT_AGE_MS;
}

export async function deliverNewUsgsAlerts(alerts: Array<{ alertId: string; source: string; eventMagnitude: number; region: string; locality: string; originTimeUtc: string; severity: string; detectedAt: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Private push storage is unavailable.");
  const enabled = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.enabled, true));
  const vapid = await vapidConfiguration();
  webpush.setVapidDetails(process.env.WEB_PUSH_SUBJECT || "https://japanseismic-269jnxjv.manus.space", vapid.publicKey, vapid.privateKey);
  let sent = 0, filtered = 0, failed = 0, invalid = 0;
  for (const alert of alerts) for (const subscription of enabled) {
    if (!subscriptionCanReceiveAlert(subscription, alert)) { filtered += 1; continue; }
    const deliveryKey = `${alert.alertId}:${subscription.id}`;
    try { await db.insert(pushDeliveries).values({ deliveryKey, alertId: alert.alertId, subscriptionId: subscription.id, status: "pending" }); } catch { continue; }
    try {
      const parsed = JSON.parse(subscription.subscriptionJson) as BrowserPushSubscription;
      await webpush.sendNotification(parsed, JSON.stringify({ title: "Japan Seismic Monitor", body: `USGS detected M${alert.eventMagnitude.toFixed(1)} near ${alert.locality}. This is not an official warning.`, tag: `usgs-${alert.alertId}`, data: { url: "/alerts" } }), { TTL: 3600, urgency: alert.severity === "high" ? "high" : "normal" });
      await db.update(pushDeliveries).set({ status: "sent", deliveredAt: new Date() }).where(eq(pushDeliveries.deliveryKey, deliveryKey));
      await db.update(pushSubscriptions).set({ lastPushAt: new Date(), failureCount: 0 }).where(eq(pushSubscriptions.id, subscription.id));
      sent += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : 0;
      const invalidSubscription = statusCode === 404 || statusCode === 410;
      await db.update(pushDeliveries).set({ status: invalidSubscription ? "invalid_subscription" : "failed", failureCode: statusCode ? String(statusCode) : "send_failed" }).where(eq(pushDeliveries.deliveryKey, deliveryKey));
      if (invalidSubscription) { await db.update(pushSubscriptions).set({ enabled: false }).where(eq(pushSubscriptions.id, subscription.id)); invalid += 1; } else { failed += 1; }
    }
  }
  return { sent, filtered, failed, invalid };
}
