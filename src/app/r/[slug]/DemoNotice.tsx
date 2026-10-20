import { isDemoRestaurant } from "@/lib/demo/policy";
import styles from "./demo-notice.module.css";

export default function DemoNotice({ restaurantId }: { restaurantId: string }) {
  if (!isDemoRestaurant(restaurantId)) return null;
  return <aside className={styles.notice} aria-label="Demonstration restaurant">
    <strong>A little taste of Menu Man.</strong> Super Tacos is fictional. Explore, customize, and try a demo pickup order.
    No real payment, food preparation, calls, or emails. Photos are illustrative.
  </aside>;
}
