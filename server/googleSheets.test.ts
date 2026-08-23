import { describe, expect, it } from "vitest";
import { ensureLiveSpreadsheet, LIVE_SHEET_TABS, parseServiceAccount, RAW_HEADERS, readRawEarthquakeRows } from "./googleSheets";

describe("live Google Sheets dataset", () => {
  it("accepts a base64 service-account representation without returning secret material", () => {
    const raw = JSON.stringify({ type: "service_account", client_email: "collector@example.test", private_key: "test-key", token_uri: "https://oauth2.example.test/token" });
    const parsed = parseServiceAccount(Buffer.from(raw).toString("base64"));
    expect(parsed.client_email).toBe("collector@example.test");
    expect(() => parseServiceAccount("not-a-service-account-secret")).toThrow("Invalid Google service-account configuration");
  });

  it("creates or reuses the authorized spreadsheet with the required worksheet structure", async () => {
    expect(process.env.GOOGLE_SHEETS_SPREADSHEET_ID, "GOOGLE_SHEETS_SPREADSHEET_ID must be configured").toMatch(/^[A-Za-z0-9_-]+$/);
    const spreadsheetId = await ensureLiveSpreadsheet();
    expect(spreadsheetId).toBe(process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
    expect(spreadsheetId).toMatch(/^[A-Za-z0-9_-]+$/);
    const dataset = await readRawEarthquakeRows();
    expect(dataset.spreadsheetId).toBe(spreadsheetId);
    expect(LIVE_SHEET_TABS).toEqual(expect.arrayContaining(["RAW_EARTHQUAKES", "FEATURES", "TRAINING_DATA", "PREDICTIONS", "MODEL_METRICS", "SYSTEM_LOG"]));
    expect(RAW_HEADERS).toEqual(expect.arrayContaining(["event_id", "source_url", "raw_value", "normalized_value"]));
  }, 30_000);
});
