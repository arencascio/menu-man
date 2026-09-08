import { themePresets, isThemePresetId } from "./presets";
import type { ThemeOverrides, ThemePresetId, ThemeTokens } from "./types";

const allowedKeys = new Set<keyof ThemeOverrides>([
  "primary", "accent", "background", "surface", "text", "mutedText",
  "headingFont", "bodyFont", "borderRadius", "contentWidth", "sectionGap", "cardGap",
]);
const colorPattern = /^#[0-9a-f]{6}$/i;
const lengthPattern = /^(?:0|\d+(?:\.\d+)?)(?:px|rem|em|vw|vh|%)$/;
const fontPattern = /^[a-zA-Z0-9 ,.-]+$/;

function safeValue(key: keyof ThemeOverrides, value: unknown): value is string {
  if (typeof value !== "string" || value.length > 120) return false;
  if (["primary", "accent", "background", "surface", "text", "mutedText"].includes(key)) return colorPattern.test(value);
  if (["borderRadius", "contentWidth", "sectionGap", "cardGap"].includes(key)) return lengthPattern.test(value);
  return fontPattern.test(value);
}

export function resolveTheme(presetValue: unknown, overridesValue: unknown): ThemeTokens & { preset: ThemePresetId } {
  const preset = isThemePresetId(presetValue) ? presetValue : "classic-red";
  const base = themePresets[preset];
  const overrides = overridesValue && typeof overridesValue === "object" && !Array.isArray(overridesValue)
    ? overridesValue as Record<string, unknown>
    : {};
  const validated: ThemeOverrides = {};

  for (const [key, value] of Object.entries(overrides)) {
    if (allowedKeys.has(key as keyof ThemeOverrides) && safeValue(key as keyof ThemeOverrides, value)) {
      validated[key as keyof ThemeOverrides] = value;
    }
  }

  return {
    preset,
    colors: {
      primary: validated.primary || base.colors.primary,
      accent: validated.accent || base.colors.accent,
      background: validated.background || base.colors.background,
      surface: validated.surface || base.colors.surface,
      text: validated.text || base.colors.text,
      mutedText: validated.mutedText || base.colors.mutedText,
    },
    typography: {
      headingFont: validated.headingFont || base.typography.headingFont,
      bodyFont: validated.bodyFont || base.typography.bodyFont,
    },
    shape: {
      borderRadius: validated.borderRadius || base.shape.borderRadius,
      contentWidth: validated.contentWidth || base.shape.contentWidth,
    },
    density: {
      sectionGap: validated.sectionGap || base.density.sectionGap,
      cardGap: validated.cardGap || base.density.cardGap,
    },
  };
}
