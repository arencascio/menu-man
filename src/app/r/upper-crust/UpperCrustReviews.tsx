import RestaurantReviews from "../[slug]/RestaurantReviews";
import YelpReviewWidgetScript from "./YelpReviewWidgetScript";
import styles from "./upper-crust-details.module.css";

const yelpEmbeds = [
  { reviewId: "uFgzOfNbZyjh0QqCWNBwvQ", userId: "m4DXFDZXiODdha_yhwZsgQ" },
  { reviewId: "eR40QqkXykPzWkunBsJLHQ", userId: "_lDW6CHf3N9O_2ppeL4vTw" },
  { reviewId: "7nNmA6Ir_ZFQ8lD8UJn8cg", userId: "z9cIFIgrqBTjQmoN628NXg" },
] as const;
export default function UpperCrustReviews() {
  return <div className={styles.googleReviews}>
    <RestaurantReviews title="Reviews" items={[]} yelpEmbeds={yelpEmbeds}
      autoAdvance autoAdvanceInterval={11000} controlsPlacement="sides" svgControls />
    <YelpReviewWidgetScript />
  </div>;
}
