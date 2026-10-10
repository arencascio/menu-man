import type { RestaurantSectionSurfacePaint } from "./section-surfaces";

export type RestaurantSectionEdgeMode = "stretch" | "repeat";

type RestaurantSectionEdgePreset = {
  name: string;
  assetUrl: string;
  mode: RestaurantSectionEdgeMode;
  height: number;
  mobileHeight: number;
  tileWidth: string;
  flipY: boolean;
};

// Source assets live in img/edges; public/img/edges contains served copies.
// Silhouettes have their straight side at the top and irregular side at the bottom.
export const restaurantSectionEdges = {
  "torn-edge-top-01": {
    name: "Torn paper top edge 01",
    assetUrl: "/img/edges/tornEdgeDown-01.svg",
    mode: "stretch",
    height: 24,
    mobileHeight: 16,
    tileWidth: "360px",
    flipY: true,
  },
  "torn-edge-bottom-01": {
    name: "Torn paper bottom edge 01",
    assetUrl: "/img/edges/tornEdgeDown-02.svg",
    mode: "stretch",
    height: 24,
    mobileHeight: 16,
    tileWidth: "360px",
    flipY: false,
  },
} as const satisfies Record<string, RestaurantSectionEdgePreset>;

export type RestaurantSectionEdgeName = keyof typeof restaurantSectionEdges;

export type RestaurantSectionEdgeTreatment = {
  preset: RestaurantSectionEdgeName;
  height?: number | string;
  paint?: RestaurantSectionSurfacePaint;
  flipX?: boolean;
  flipY?: boolean;
  mode?: RestaurantSectionEdgeMode;
  tileWidth?: string;
};

export function getRestaurantSectionEdgeHeights(treatment: RestaurantSectionEdgeTreatment) {
  const preset = restaurantSectionEdges[treatment.preset];
  const toCssLength = (value: number | string) => typeof value === "number" ? `${value}px` : value;
  return {
    desktop: toCssLength(treatment.height ?? preset.height),
    mobile: toCssLength(treatment.height ?? preset.mobileHeight),
  };
}
