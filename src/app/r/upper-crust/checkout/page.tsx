import SampleCheckout from "../../[slug]/SuperTacosDemoCheckout";
import { upperCrust } from "@/lib/upper-crust/config";
import styles from "../upper-crust.module.css";

export default function UpperCrustCheckout() {
  return <div id="main-content" className={styles.checkout}><SampleCheckout brand={{ id: upperCrust.id, slug: upperCrust.slug, name: upperCrust.shortName, receiptPrefix: "UC", returnHref: "/r/upper-crust/menu", returnLabel: "Back to the menu" }}/></div>;
}
