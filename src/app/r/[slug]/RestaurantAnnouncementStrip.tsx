import styles from "./restaurant-shell.module.css";
import detailStyles from "./restaurant-detail-strip.module.css";
import patternStyles from "@/lib/restaurant-presentation/patterns.module.css";
import { getRestaurantPatternStyle, type RestaurantPatternName } from "@/lib/restaurant-presentation/patterns";

export type RestaurantDetailItem = {
  text: string;
  icon: "flag" | "utensils" | "moon" | "truck";
};

type RestaurantAnnouncementStripProps = {
  messages?: readonly string[];
  items?: readonly RestaurantDetailItem[];
  pattern?: RestaurantPatternName;
};

export default function RestaurantAnnouncementStrip({ messages = [], items, pattern }: RestaurantAnnouncementStripProps) {
  if (items?.length) {
    return (
      <aside
        className={`${detailStyles.strip} ${pattern ? patternStyles.pattern : ""}`}
        style={pattern ? getRestaurantPatternStyle(pattern) : undefined}
        aria-label="Restaurant details"
        data-pattern={pattern}
      >
        <ul className={detailStyles.list}>
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
