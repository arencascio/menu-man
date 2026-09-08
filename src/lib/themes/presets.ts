import type { ThemePresetId, ThemeTokens } from "./types";

export const themePresets: Record<ThemePresetId, ThemeTokens> = {
  "classic-red": {
    colors: {
      primary: "#5b0000",
      accent: "#b70000",
      background: "#f7f7f2",
      surface: "#ffffff",
      text: "#171717",
      mutedText: "#666666",
    },
    typography: {
      headingFont: "Arial, Helvetica, sans-serif",
      bodyFont: "Arial, Helvetica, sans-serif",
    },
    shape: {
      borderRadius: "14px",
      contentWidth: "1440px",
    },
    density: {
      sectionGap: "22px",
      cardGap: "22px",
    },
  },
};

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return typeof value === "string" && value in themePresets;
}
