import { describe, expect, it } from "vitest";
import { subscriptionMatchesAlert } from "./pushSubscriptions";
import { trustedWorkflowClaims } from "./pushDelivery";

describe("background push safeguards", () => {
  it("accepts only the deployed hourly USGS workflow identity", () => {
    expect(trustedWorkflowClaims({ iss: "https://token.actions.githubusercontent.com", aud: "japan-seismic-push", repository: "yve2482005/japan-seismic-risk", workflow_ref: "yve2482005/japan-seismic-risk/.github/workflows/live-usgs-collection.yml@refs/heads/main" })).toBe(true);
    expect(trustedWorkflowClaims({ iss: "https://token.actions.githubusercontent.com", aud: "japan-seismic-push", repository: "untrusted/repository", workflow_ref: "untrusted/repository/.github/workflows/live-usgs-collection.yml@refs/heads/main" })).toBe(false);
  });

  it("allows only matching USGS alerts to reach a subscribed device", () => {
    const subscription = { enabled: true, minimumMagnitude: 5, regionsJson: JSON.stringify(["Kanto"]) };
    expect(subscriptionMatchesAlert(subscription, { source: "USGS", eventMagnitude: 5.2, region: "Kanto" })).toBe(true);
    expect(subscriptionMatchesAlert(subscription, { source: "JMA", eventMagnitude: 6.2, region: "Kanto" })).toBe(false);
    expect(subscriptionMatchesAlert(subscription, { source: "USGS", eventMagnitude: 4.9, region: "Kanto" })).toBe(false);
    expect(subscriptionMatchesAlert(subscription, { source: "USGS", eventMagnitude: 5.2, region: "Tohoku" })).toBe(false);
  });
});
