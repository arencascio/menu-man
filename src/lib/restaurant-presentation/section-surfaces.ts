import type { CSSProperties } from "react";
import { getRestaurantPatternStyle, type RestaurantPatternName } from "./patterns";

// Paint is independent of the SVG geometry. Inherit consumes the enclosing
// section's surface variables; standalone surfaces fall back to theme-surface.
export type RestaurantSectionSurfacePaint =
  | { mode: "inherit" }
  | { mode: "solid"; color: string }
  | { mode: "gradient"; gradient: string }
  | { mode: "pattern"; pattern: RestaurantPatternName };

export function getRestaurantSectionSurfaceStyle(paint: RestaurantSectionSurfacePaint): CSSProperties {
  if (paint.mode === "inherit") return {};
  if (paint.mode === "pattern") return {
    ...getRestaurantPatternStyle(paint.pattern),
    "--section-surface-background": "var(--pattern-background)",
    "--section-surface-pattern": "var(--pattern-asset)",
    "--section-surface-pattern-opacity": "var(--pattern-opacity)",
  } as CSSProperties;
  return {
    "--section-surface-background": paint.mode === "solid" ? paint.color : paint.gradient,
    "--section-surface-pattern": "none",
    "--section-surface-pattern-opacity": 0,
  } as CSSProperties;
}
