export type ThemePreference = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function nextThemePreference(theme: ThemePreference): ThemePreference {
  return theme === "light" ? "dark" : "light";
}
