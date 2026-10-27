import MenuBrowser from "../../[slug]/MenuBrowser";
import { upperCrust, upperCrustSections } from "@/lib/upper-crust/config";
import styles from "../upper-crust.module.css";

export default function UpperCrustMenu() {
  return <div id="main-content" className={styles.menu}><MenuBrowser cartPreview displayStyle="upper-crust" restaurantId={upperCrust.id} restaurantSlug={upperCrust.slug} currency="USD" sections={upperCrustSections} initialHeartCounts={{}} ariaLabel="Upper Crust concept menu" initialActivePayment={null}/></div>;
}
