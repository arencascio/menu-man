import { getRestaurantPatternStyle, type RestaurantPatternName } from "@/lib/restaurant-presentation/patterns";
import patternStyles from "@/lib/restaurant-presentation/patterns.module.css";

export default function RestaurantPatternSeparator({ className, pattern }: {
  className: string;
  pattern: RestaurantPatternName;
}) {
  return <div className={`${patternStyles.pattern} ${className}`} style={getRestaurantPatternStyle(pattern)} aria-hidden="true" data-restaurant-pattern={pattern} />;
}
