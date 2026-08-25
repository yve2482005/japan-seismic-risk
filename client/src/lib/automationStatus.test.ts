import { describe, expect, it } from "vitest";
import { automationStatusLabel, getAutomationStatus } from "./automationStatus";

describe("overall automation status", () => {
  it("keeps collection and reliability pending until source telemetry exists", () => {
    const status = getAutomationStatus({
      collectionStatus: "awaiting_first_scheduled_collection",
      freshnessMinutes: null,
      reliability: null,
      notificationsStatus: "permission_required_background_sender_unconfigured",
      modelStatus: "awaiting_validated_history",
    });
    expect(status).toEqual({ collection: "pending", refresh: "pending", reliability: "pending", alerts: "pending", model: "gated" });
  });

  it("shows healthy automatic operation for fresh verified collection without retries", () => {
    const status = getAutomationStatus({
      collectionStatus: "active",
      freshnessMinutes: 18,
      reliability: { latestStatus: "success", retryAttempts: 0 },
      notificationsStatus: "configured",
      modelStatus: "production",
    });
    expect(status).toEqual({ collection: "healthy", refresh: "active", reliability: "healthy", alerts: "healthy", model: "healthy" });
  });

  it("surfaces attention when the latest collection failed or the source is stale", () => {
    const status = getAutomationStatus({
      collectionStatus: "stale",
      freshnessMinutes: 240,
      reliability: { latestStatus: "failure", retryAttempts: 4 },
      notificationsStatus: "permission_required_background_sender_unconfigured",
      modelStatus: "candidate",
    });
    expect(status.collection).toBe("attention");
    expect(status.refresh).toBe("attention");
    expect(status.reliability).toBe("attention");
    expect(status.model).toBe("gated");
    expect(automationStatusLabel(status.reliability)).toBe("ပြန်စစ်ရန် လိုအပ်သည်");
  });

  it("shows retry activity without treating a successful retried run as a failure", () => {
    const status = getAutomationStatus({
      collectionStatus: "active",
      freshnessMinutes: 45,
      reliability: { latestStatus: "success", retryAttempts: 2 },
      notificationsStatus: "permission_required_background_sender_unconfigured",
      modelStatus: "awaiting_validated_history",
    });
    expect(status.collection).toBe("healthy");
    expect(status.reliability).toBe("active");
  });
});
