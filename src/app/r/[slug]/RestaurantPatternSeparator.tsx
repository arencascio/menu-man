import { getRestaurantPatternStyle, type RestaurantPatternName } from "@/lib/restaurant-presentation/patterns";
import patternStyles from "@/lib/restaurant-presentation/patterns.module.css";
import styles from "./restaurant-pattern-separator.module.css";

export default function RestaurantPatternSeparator({ className, pattern = "brick-wall" }: {
  className?: string;
  pattern?: RestaurantPatternName;
}) {
  return <div className={[patternStyles.pattern, styles.separator, className].filter(Boolean).join(" ")} style={getRestaurantPatternStyle(pattern)} aria-hidden="true" data-restaurant-pattern={pattern} />;
}
