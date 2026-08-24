import { describe, expect, it } from "vitest";
import { activityLabel, modelStatusCopy } from "./dashboardCopy";

describe("user-facing dashboard copy", () => {
  it("does not imply a prediction when no production model is present", () => {
    expect(modelStatusCopy("awaiting_validated_history")).toContain("အတုခန့်မှန်းချက် မထုတ်ပါ");
  });

  it("keeps production output labelled as a probability rather than an official warning", () => {
    expect(modelStatusCopy("production")).toContain("တရားဝင်သတိပေးချက် မဟုတ်ပါ");
  });

  it("uses a plain-language empty activity label", () => {
    expect(activityLabel(0)).toBe("မတွေ့ရှိပါ");
  });
});
