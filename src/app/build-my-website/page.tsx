import { createMarketingMetadata } from "@/lib/seo/marketing-metadata";
import { MarketingPage } from "../MarketingComponents";
import { BuildWebsiteForm } from "../MarketingInteractions";
import { PUBLIC_PRICING } from "../marketing-content";
import styles from "../page.module.css";

export const metadata = createMarketingMetadata("/build-my-website");

export default function BuildMyWebsitePage() {
  return (
    <MarketingPage>
      <section className={styles.leadPage}>
        <div className={styles.leadIntro}>
          <h1>Tell us about your restaurant.</h1>
          <p>Share what you have, what is not working, and where customers order today.</p>
          <div className={styles.leadPrice}>
            <strong>{PUBLIC_PRICING.monthly}</strong>
            <p>{PUBLIC_PRICING.startupFee} setup payment at project start. No monthly charges while we build; {PUBLIC_PRICING.monthly} starts at launch.</p>
          </div>
          <ul>
            <li>No enterprise sales process</li>
            <li>Your current ordering system can stay</li>
            <li>No website dashboard to learn</li>
          </ul>
        </div>
        <BuildWebsiteForm />
      </section>
    </MarketingPage>
  );
}
