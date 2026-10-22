import type { Metadata } from "next";
import { FinalCta, MarketingPage, PrimaryLink, WorkingProductIntro } from "../MarketingComponents";
import MarketingFeaturettes from "../MarketingFeaturettes";
import MarketingPhoneShowcase from "../MarketingPhoneShowcase";
import RestaurantShowcases from "../RestaurantShowcases";
import { CTA_LABELS } from "../marketing-content";
import styles from "../page.module.css";
import MarketingIcon from "../MarketingIcon";

export const metadata: Metadata = {
  title: "Work",
  description: "Explore Menu Man's restaurant website capabilities: mobile-friendly menus, existing ordering links, hours, and location details. An illustrated product overview.",
};

export default function WorkPage() {
  return (
    <MarketingPage>
      <section className={`${styles.subpageHero} ${styles.workHero}`}>
        <div>
          <h1>A closer look at the product.</h1>
          <p>Explore Super Tacos, a fictional restaurant demonstration of bold branding, thoughtful menu browsing, and clear restaurant information.</p>
          <div className={styles.actionRow}>
            <PrimaryLink href="/build-my-website" ctaId="build_website" placement="hero">{CTA_LABELS.showcase}</PrimaryLink>
          </div>
        </div>
        <div className={styles.workHeroVisual}><MarketingPhoneShowcase /></div>
      </section>

      <section className={`${styles.gallerySection} ${styles.homeWorkSection}`}>
        <WorkingProductIntro />
        <RestaurantShowcases eager />
        <div className={styles.workCapabilities} data-work-features>
          <MarketingFeaturettes />
        </div>
      </section>

      <section className={styles.galleryCta} data-work-conversion>
        <MarketingIcon name="sparkles" size={36} />
        <h2>Want this kind of clarity for your restaurant?</h2>
        <PrimaryLink href="/build-my-website" ctaId="build_website">{CTA_LABELS.showcase}</PrimaryLink>
      </section>

      <FinalCta />
    </MarketingPage>
  );
}
