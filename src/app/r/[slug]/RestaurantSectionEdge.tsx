import type { CSSProperties } from "react";
import {
  getRestaurantSectionEdgeHeights,
  restaurantSectionEdges,
  type RestaurantSectionEdgeTreatment,
} from "@/lib/restaurant-presentation/section-edges";
import styles from "./restaurant-section-edge.module.css";
import surfaceStyles from "@/lib/restaurant-presentation/section-surfaces.module.css";
import { getRestaurantSectionSurfaceStyle } from "@/lib/restaurant-presentation/section-surfaces";

export type RestaurantSectionEdgeProps = RestaurantSectionEdgeTreatment & {
  placement: "top" | "bottom";
};

export default function RestaurantSectionEdge({ placement, ...treatment }: RestaurantSectionEdgeProps) {
  const preset = restaurantSectionEdges[treatment.preset];
  const mode = treatment.mode ?? preset.mode;
  const height = getRestaurantSectionEdgeHeights(treatment);
  const flipY = treatment.flipY ?? preset.flipY;
  const paint = treatment.paint ?? { mode: "inherit" };

  return <div
    className={`${styles.edge} ${styles[placement]}`}
    aria-hidden="true"
    data-section-edge={treatment.preset}
    data-placement={placement}
    data-render-mode={mode}
    data-paint-mode={paint.mode}
    style={{
      ...getRestaurantSectionSurfaceStyle(paint),
      "--section-edge-asset": `url("${preset.assetUrl}")`,
      "--section-edge-height": height.desktop,
      "--section-edge-mobile-height": height.mobile,
      "--section-edge-size": mode === "stretch" ? "100% 100%" : `${treatment.tileWidth ?? preset.tileWidth} 100%`,
      "--section-edge-repeat": mode === "stretch" ? "no-repeat" : "repeat-x",
      "--section-edge-flip-x": treatment.flipX ? -1 : 1,
      "--section-edge-flip-y": flipY ? -1 : 1,
    } as CSSProperties}
  >
    <div className={`${styles.paint} ${surfaceStyles.surface}`} data-section-edge-surface />
  </div>;
}
