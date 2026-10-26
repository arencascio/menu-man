import MenuBrowser from "../../[slug]/MenuBrowser";
import { upperCrust, upperCrustSections } from "@/lib/upper-crust/config";
import styles from "../upper-crust.module.css";

export default function UpperCrustMenu() {
  return <div id="main-content" className={styles.menu}><MenuBrowser cartPreview displayStyle="upper-crust" controlsNote={<aside className={styles.menuDisclaimer}>All prices, options and combinations are illustrative demo values. Current menu, availability and prices require restaurant confirmation. Orders are simulated.</aside>} restaurantId={upperCrust.id} restaurantSlug={upperCrust.slug} currency="USD" sections={upperCrustSections} initialHeartCounts={{}} ariaLabel="Upper Crust concept menu" initialActivePayment={null}/></div>;
}
