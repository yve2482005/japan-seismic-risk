import { describe, expect, it } from "vitest";

describe("browser push prerequisites", () => {
  it("keeps the service-worker notification path outside the standard in-app sound path", () => {
    expect("PushManager" in globalThis).toBe(false);
  });
});
