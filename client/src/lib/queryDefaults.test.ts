import { describe, expect, it } from "vitest";
import { QUERY_DEFAULTS } from "./queryDefaults";

describe("live monitoring query defaults", () => {
  it("keeps recent verified data briefly while still refreshing on focus and reconnect", () => {
    expect(QUERY_DEFAULTS.queries.staleTime).toBe(30_000);
    expect(QUERY_DEFAULTS.queries.gcTime).toBe(300_000);
    expect(QUERY_DEFAULTS.queries.retry).toBe(1);
    expect(QUERY_DEFAULTS.queries.refetchOnWindowFocus).toBe(true);
    expect(QUERY_DEFAULTS.queries.refetchOnReconnect).toBe(true);
  });
});
