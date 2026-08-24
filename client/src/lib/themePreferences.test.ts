import { describe, expect, it } from "vitest";
import { isThemePreference, nextThemePreference } from "./themePreferences";

describe("theme preferences", () => {
  it("accepts only supported saved themes", () => {
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("system")).toBe(false);
  });

  it("switches deterministically between light and dark modes", () => {
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("light");
  });
});
