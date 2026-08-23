import { describe, expect, it } from "vitest";
import { ensureLiveSpreadsheet, LIVE_SHEET_TABS, RAW_HEADERS, readRawEarthquakeRows } from "./googleSheets";

describe("live Google Sheets dataset", () => {
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
