import type { Metadata } from "next";
import { MarketingPage } from "../MarketingComponents";
import { BuildWebsiteForm } from "../MarketingInteractions";
import { PUBLIC_PRICING } from "../marketing-content";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Build My Website",
  description: "Tell Menu Man about your restaurant and the website help you need.",
};

type Props = {
  searchParams: Promise<{ inspiredBy?: string | string[] }>;
};

export default async function BuildMyWebsitePage({ searchParams }: Props) {
  const params = await searchParams;
  const inspiredBy = Array.isArray(params.inspiredBy) ? params.inspiredBy[0] : params.inspiredBy;

  return (
    <MarketingPage>
      <section className={styles.leadPage}>
        <div className={styles.leadIntro}>
          <p className={styles.eyebrow}>Build my website</p>
          <h1>Tell us about your restaurant.</h1>
          <p>Share what you have, what is not working, and where customers order today. Plain English is perfect.</p>
          <div className={styles.leadPrice}>
            <span>Public price</span>
            <strong>{PUBLIC_PRICING.monthly}</strong>
            <small>{PUBLIC_PRICING.setup}</small>
          </div>
          <ul>
            <li>No enterprise sales process</li>
            <li>Your current ordering system can stay</li>
            <li>No website dashboard to learn</li>
          </ul>
        </div>
        <BuildWebsiteForm inspiredBy={inspiredBy} />
      </section>
    </MarketingPage>
  );
}
