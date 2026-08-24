import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { readSheetRows } from "./googleSheets";
import { deliverNewUsgsAlerts, isCanonicalUsgsAlertSource } from "./pushSubscriptions";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "japan-seismic-push";
const REPOSITORY = "yve2482005/japan-seismic-risk";
const WORKFLOW_REF = `${REPOSITORY}/.github/workflows/live-usgs-collection.yml@refs/heads/main`;
const githubJwks = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

export function trustedWorkflowClaims(claims: JWTPayload) {
  return claims.iss === ISSUER && claims.aud === AUDIENCE && claims.repository === REPOSITORY && claims.workflow_ref === WORKFLOW_REF;
}

export async function verifyWorkflowToken(token: string) {
  const result = await jwtVerify(token, githubJwks, { issuer: ISSUER, audience: AUDIENCE });
  if (!trustedWorkflowClaims(result.payload)) throw new Error("Untrusted workflow identity.");
  return result.payload;
}

function text(row: Record<string, string>, key: string) { return String(row[key] ?? "").trim(); }
function numberValue(row: Record<string, string>, key: string) { const value = Number(text(row, key)); return Number.isFinite(value) ? value : null; }

export async function deliverPendingPushAlerts() {
  const { rows } = await readSheetRows("ALERTS");
  const alerts = rows.map(row => ({
    alertId: text(row, "alert_id"), source: text(row, "source"), eventMagnitude: numberValue(row, "event_magnitude"), region: text(row, "region"), locality: text(row, "locality"), originTimeUtc: text(row, "origin_time_utc"), severity: text(row, "severity").toLowerCase(), detectedAt: text(row, "detected_at"),
  })).filter((alert): alert is { alertId: string; source: string; eventMagnitude: number; region: string; locality: string; originTimeUtc: string; severity: string; detectedAt: string } => Boolean(alert.alertId && isCanonicalUsgsAlertSource(alert.source) && alert.eventMagnitude !== null && alert.region && alert.locality && alert.originTimeUtc && alert.detectedAt));
  return deliverNewUsgsAlerts(alerts);
}
