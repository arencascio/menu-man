import { productFeatures } from "./marketing-content";
import MarketingIcon, { type MarketingIconName } from "./MarketingIcon";
import MarketingReveal from "./MarketingReveal";
import styles from "./page.module.css";

const icons: MarketingIconName[] = ["phone", "menu", "sparkles"];
const details = [
  "Give guests a clear route from a quick look to their next visit, with restaurant information kept close at hand.",
  "Search by dish name or browse a category. Each restaurant keeps its own photography and personality.",
  "Keep the tools your team already uses. The website makes the next step easy to find.",
];

export default function MarketingCapabilities() {
  return <MarketingReveal className={styles.capabilityGrid}>
    {productFeatures.slice(0, 3).map((feature, index) => <details key={feature.id} className={styles.capabilityCard} data-reveal-item>
      <summary>
        <MarketingIcon name={icons[index]} size={32} />
        <h3>{feature.title}</h3>
        <p>{feature.copy}</p>
        <span className={styles.disclosureHint}>Explore this capability <MarketingIcon name="chevron" size={18} /></span>
      </summary>
      <div className={styles.capabilityMore}>{details[index]}</div>
    </details>)}
  </MarketingReveal>;
}
