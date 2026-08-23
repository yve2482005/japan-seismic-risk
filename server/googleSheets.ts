import { createSign } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { systemLogs } from "../drizzle/schema";
import { getDb } from "./db";

export const LIVE_SHEET_TABS = ["RAW_EARTHQUAKES", "FEATURES", "TRAINING_DATA", "PREDICTIONS", "MODEL_METRICS", "SYSTEM_LOG"] as const;
export const RAW_HEADERS = ["event_id", "source", "source_url", "origin_time_utc", "local_time_japan", "latitude", "longitude", "depth_km", "magnitude", "magnitude_type", "region", "prefecture", "nearest_city", "event_type", "collection_time", "data_quality", "duplicate_status", "raw_value", "normalized_value", "source_updated_epoch_ms"] as const;
const TAB_HEADERS: Record<(typeof LIVE_SHEET_TABS)[number], readonly string[]> = {
  RAW_EARTHQUAKES: RAW_HEADERS,
  FEATURES: ["event_id", "feature_as_of_utc", "region", "target_name", "features_json", "created_at"],
  TRAINING_DATA: ["event_id", "target_name", "label", "feature_version", "dataset_version", "created_at"],
  PREDICTIONS: ["prediction_id", "model_version", "region", "target_definition", "probability", "risk_level", "generated_at"],
  MODEL_METRICS: ["model_version", "algorithm", "target_definition", "dataset_version", "metrics_json", "calibration_json", "status", "trained_at"],
  SYSTEM_LOG: ["timestamp_utc", "component", "severity", "message", "context_json"],
};

type ServiceAccount = { type: string; client_email: string; private_key: string; token_uri: string };
let accessTokenCache: { token: string; expiresAt: number } | null = null;
let spreadsheetPromise: Promise<string> | null = null;

function base64Url(value: string) { return Buffer.from(value).toString("base64url"); }
function account() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required for live Google Sheets synchronization.");
  const value = JSON.parse(raw) as ServiceAccount;
  if (value.type !== "service_account" || !value.client_email || !value.private_key || !value.token_uri) throw new Error("Invalid Google service-account configuration.");
  return value;
}
function assertion(value: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iss: value.client_email, scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file", aud: value.token_uri, iat: now, exp: now + 300 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`); signer.end();
  return `${header}.${payload}.${signer.sign(value.private_key).toString("base64url")}`;
}
async function accessToken() {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) return accessTokenCache.token;
  const value = account();
  const response = await fetch(value.token_uri, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: assertion(value) }) });
  if (!response.ok) throw new Error(`Google token request failed (${response.status}).`);
  const json = await response.json() as { access_token: string; expires_in: number };
  accessTokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}
async function googleJson<T>(url: string, options: RequestInit = {}) {
  const token = await accessToken();
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers ?? {}) } });
  if (!response.ok) {
    const body = await response.text();
    const reason = body.slice(0, 500).replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
    throw new Error(`Google API request failed (${response.status}): ${reason}`);
  }
  return response.json() as Promise<T>;
}

async function storedSpreadsheetId() {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.select().from(systemLogs).where(and(eq(systemLogs.component, "google_sheets"), eq(systemLogs.message, "Live spreadsheet initialized"))).orderBy(desc(systemLogs.createdAt)).limit(1))[0];
  if (!row?.contextJson) return null;
  try { return (JSON.parse(row.contextJson) as { spreadsheetId?: string }).spreadsheetId ?? null; } catch { return null; }
}

async function persistSpreadsheetId(spreadsheetId: string) {
  const db = await getDb();
  if (db) await db.insert(systemLogs).values({ component: "google_sheets", severity: "info", message: "Live spreadsheet initialized", contextJson: JSON.stringify({ spreadsheetId, ownerShared: Boolean(process.env.GOOGLE_SHEETS_OWNER_EMAIL) }) });
}

export async function ensureLiveSpreadsheet() {
  if (!spreadsheetPromise) spreadsheetPromise = (async () => {
    const configured = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
    const stored = await storedSpreadsheetId();
    let spreadsheetId = configured || stored;
    if (!spreadsheetId) {
      const created = await googleJson<{ spreadsheetId: string }>("https://sheets.googleapis.com/v4/spreadsheets", { method: "POST", body: JSON.stringify({ properties: { title: "Japan Seismic Monitor — Live Dataset" }, sheets: LIVE_SHEET_TABS.map(title => ({ properties: { title } })) }) });
      spreadsheetId = created.spreadsheetId;
      const owner = process.env.GOOGLE_SHEETS_OWNER_EMAIL;
      if (owner) await googleJson(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions?sendNotificationEmail=true`, { method: "POST", body: JSON.stringify({ type: "user", role: "writer", emailAddress: owner }) });
    }
    const metadata = await googleJson<{ sheets: Array<{ properties: { title: string } }> }>(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`);
    const existingTabs = new Set(metadata.sheets.map(sheet => sheet.properties.title));
    const addRequests = LIVE_SHEET_TABS.filter(title => !existingTabs.has(title)).map(title => ({ addSheet: { properties: { title } } }));
    if (addRequests.length) await googleJson(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: addRequests }) });
    for (const tab of LIVE_SHEET_TABS) await googleJson(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tab}!A1?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [TAB_HEADERS[tab]] }) });
    if (!stored) await persistSpreadsheetId(spreadsheetId);
    return spreadsheetId;
  })();
  return spreadsheetPromise;
}

export async function readSheetRows(tab: (typeof LIVE_SHEET_TABS)[number]) {
  const spreadsheetId = await ensureLiveSpreadsheet();
  const result = await googleJson<{ values?: string[][] }>(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tab}!A:Z`);
  const [headers = [], ...rows] = result.values ?? [];
  return { spreadsheetId, rows: rows.filter(row => row[0]).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))) };
}

export async function readRawEarthquakeRows() {
  return readSheetRows("RAW_EARTHQUAKES");
}
