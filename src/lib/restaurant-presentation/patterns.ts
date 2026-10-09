import type { CSSProperties } from "react";

// Source assets live in img/patterns; public/img/patterns contains served copies.
export const restaurantPatterns = {
  "brick-wall": {
    name: "Brick wall",
    assetUrl: "/img/patterns/brick-wall.svg",
    backgroundColor: "#F7F2F2",
    color: "#8B1712",
    opacity: .32,
    size: "42px 44px",
    repeat: "repeat",
    position: "0px 0px",
  },
} as const;

export type RestaurantPatternName = keyof typeof restaurantPatterns;

export function getRestaurantPatternStyle(name: RestaurantPatternName): CSSProperties {
  const pattern = restaurantPatterns[name];
  return {
    "--pattern-asset": `url("${pattern.assetUrl}")`,
    "--pattern-background": pattern.backgroundColor,
    "--pattern-color": pattern.color,
    "--pattern-opacity": pattern.opacity,
    "--pattern-size": pattern.size,
    "--pattern-repeat": pattern.repeat,
    "--pattern-position": pattern.position,
  } as CSSProperties;
}
