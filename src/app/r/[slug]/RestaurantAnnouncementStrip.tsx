import styles from "./restaurant-shell.module.css";
import detailStyles from "./restaurant-detail-strip.module.css";
import surfaceStyles from "@/lib/restaurant-presentation/section-surfaces.module.css";
import type { RestaurantPatternName } from "@/lib/restaurant-presentation/patterns";
import { getRestaurantSectionSurfaceStyle } from "@/lib/restaurant-presentation/section-surfaces";
import type { CSSProperties } from "react";
import { getRestaurantSectionEdgeHeights, type RestaurantSectionEdgeTreatment } from "@/lib/restaurant-presentation/section-edges";
import RestaurantSectionEdge from "./RestaurantSectionEdge";

export type RestaurantDetailItem = {
  text: string;
  icon: "flag" | "utensils" | "moon" | "truck";
};

type RestaurantAnnouncementStripProps = {
  messages?: readonly string[];
  items?: readonly RestaurantDetailItem[];
  pattern?: RestaurantPatternName;
  contentPlate?: boolean;
  topEdge?: RestaurantSectionEdgeTreatment;
  bottomEdge?: RestaurantSectionEdgeTreatment;
};

export default function RestaurantAnnouncementStrip({ messages = [], items, pattern, contentPlate = false, topEdge, bottomEdge }: RestaurantAnnouncementStripProps) {
  if (items?.length) {
    const topHeight = topEdge ? getRestaurantSectionEdgeHeights(topEdge) : undefined;
    const bottomHeight = bottomEdge ? getRestaurantSectionEdgeHeights(bottomEdge) : undefined;
    return (
      <aside
        className={`${detailStyles.strip} ${topEdge || bottomEdge ? `${detailStyles.withEdges} ${surfaceStyles.edged}` : ""}`}
        style={{
          ...getRestaurantSectionSurfaceStyle(pattern ? { mode: "pattern", pattern } : { mode: "inherit" }),
          "--section-surface-top-edge-height": topHeight?.desktop ?? "0px",
          "--section-surface-bottom-edge-height": bottomHeight?.desktop ?? "0px",
          "--section-surface-top-edge-mobile-height": topHeight?.mobile ?? "0px",
          "--section-surface-bottom-edge-mobile-height": bottomHeight?.mobile ?? "0px",
        } as CSSProperties}
        aria-label="Restaurant details"
        data-pattern={pattern}
      >
        <div className={`${detailStyles.patternLayer} ${surfaceStyles.center} ${surfaceStyles.surface}`} aria-hidden="true" data-detail-pattern-layer />
        {topEdge ? <RestaurantSectionEdge {...topEdge} placement="top" /> : null}
        <ul className={`${detailStyles.list} ${contentPlate ? detailStyles.contentPlate : ""}`} data-content-plate={contentPlate || undefined}>
          {items.map(({ text, icon }) => (
            <li key={text} className={detailStyles.item}>
              <span className={detailStyles.icon} aria-hidden="true" style={{
                maskImage: `url("/img/icons/${icon}.svg")`,
                WebkitMaskImage: `url("/img/icons/${icon}.svg")`,
              }} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        {bottomEdge ? <RestaurantSectionEdge {...bottomEdge} placement="bottom" /> : null}
      </aside>
    );
  }
  if (messages.length === 0) return null;

  return (
    <aside className={styles.announcementStrip} aria-label="Restaurant announcements">
      <ul className={styles.announcementList}>
        {messages.map((message) => (
          <li key={message} className={styles.announcementItem}>
            {message}
          </li>
        ))}
      </ul>
    </aside>
  );
}
