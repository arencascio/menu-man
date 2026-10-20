// Client presentation configuration only. Commerce authority stays in the DB.
import type { CSSProperties } from "react";
import theme from "./theme.json";
import { isDemoRestaurant } from "./policy";

export function demoPageStyle(restaurantId: string): CSSProperties | undefined {
  if (!isDemoRestaurant(restaurantId)) return undefined;
  return {
    "--theme-primary": theme.primary, "--theme-accent": theme.accent,
    "--theme-background": theme.background, "--theme-surface": theme.surface,
    "--theme-text": theme.text, "--theme-muted-text": theme.mutedText,
  } as CSSProperties;
}

export const superTacosHero = {
  layout: "photo-split" as const,
  eyebrow: "Street food. Sunny attitude.",
  headline: "Super flavor.",
  supportingText: "Warm tortillas, fresh salsa, and all your new favorites. Make it your own, one delicious bite at a time.",
  imageAlt: "Illustrative photograph of freshly prepared tacos with colorful garnishes",
  imageUrl: "/img/super-tacos/tacos.jpg",
  imagePosition: "50% 50%",
  primaryAction: { label: "Build a demo order", href: "/r/super-tacos/menu" },
};
