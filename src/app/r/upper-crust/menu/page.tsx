import MenuBrowser from "../../[slug]/MenuBrowser";
import { upperCrust, upperCrustSections } from "@/lib/upper-crust/config";
import styles from "../upper-crust.module.css";

export default function UpperCrustMenu() {
  return <div id="main-content" className={styles.menu}><MenuBrowser cartPreview displayStyle="upper-crust" controlsNote={<aside className={styles.menuDisclaimer}>Prices are transcribed from the DoorDash Delivery menu viewed October 26, 2026; current prices and Pickup may differ. The drink category copy conflicts with its item-card prices. Customization is shown only where its choices were verified. Orders are simulated.</aside>} restaurantId={upperCrust.id} restaurantSlug={upperCrust.slug} currency="USD" sections={upperCrustSections} initialHeartCounts={{}} ariaLabel="Upper Crust concept menu" initialActivePayment={null}/></div>;
}
