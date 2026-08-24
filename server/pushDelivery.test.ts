import { describe, expect, it } from "vitest";
import { isCanonicalUsgsAlertSource, subscriptionCanReceiveAlert, subscriptionMatchesAlert } from "./pushSubscriptions";
import { trustedWorkflowClaims } from "./pushDelivery";

describe("background push safeguards", () => {
  it("accepts only the deployed hourly USGS workflow identity", () => {
    expect(trustedWorkflowClaims({ iss: "https://token.actions.githubusercontent.com", aud: "japan-seismic-push", repository: "yve2482005/japan-seismic-risk", workflow_ref: "yve2482005/japan-seismic-risk/.github/workflows/live-usgs-collection.yml@refs/heads/main" })).toBe(true);
    expect(trustedWorkflowClaims({ iss: "https://token.actions.githubusercontent.com", aud: "japan-seismic-push", repository: "untrusted/repository", workflow_ref: "untrusted/repository/.github/workflows/live-usgs-collection.yml@refs/heads/main" })).toBe(false);
  });

  it("allows only matching USGS alerts to reach a subscribed device", () => {
    const subscription = { enabled: true, minimumMagnitude: 5, regionsJson: JSON.stringify(["Kanto"]) };
    expect(subscriptionMatchesAlert(subscription, { source: "U.S. Geological Survey (USGS), ANSS ComCat", eventMagnitude: 5.2, region: "Kanto" })).toBe(true);
    expect(subscriptionMatchesAlert(subscription, { source: "JMA", eventMagnitude: 6.2, region: "Kanto" })).toBe(false);
    expect(subscriptionMatchesAlert(subscription, { source: "U.S. Geological Survey (USGS), ANSS ComCat", eventMagnitude: 4.9, region: "Kanto" })).toBe(false);
    expect(subscriptionMatchesAlert(subscription, { source: "U.S. Geological Survey (USGS), ANSS ComCat", eventMagnitude: 5.2, region: "Tohoku" })).toBe(false);
  });

  it("accepts the collector's canonical USGS attribution and excludes other sources", () => {
    expect(isCanonicalUsgsAlertSource("U.S. Geological Survey (USGS), ANSS ComCat")).toBe(true);
    expect(isCanonicalUsgsAlertSource("Japan Meteorological Agency (JMA)")).toBe(false);
  });

  it("delivers only alerts detected after activation and within the conservative freshness window", () => {
    const now = new Date("2026-08-24T04:30:00.000Z");
    const subscription = { enabled: true, minimumMagnitude: 4, regionsJson: JSON.stringify(["Kanto"]), activatedAt: new Date("2026-08-24T04:00:00.000Z") };
    const matching = { source: "U.S. Geological Survey (USGS), ANSS ComCat", eventMagnitude: 4.2, region: "Kanto", detectedAt: "2026-08-24T04:10:00.000Z" };
    expect(subscriptionCanReceiveAlert(subscription, matching, now)).toBe(true);
    expect(subscriptionCanReceiveAlert(subscription, { ...matching, detectedAt: "2026-08-24T03:59:59.000Z" }, now)).toBe(false);
    expect(subscriptionCanReceiveAlert(subscription, { ...matching, detectedAt: "2026-08-23T03:00:00.000Z" }, now)).toBe(false);
  });
});
