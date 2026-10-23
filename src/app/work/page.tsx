import { createMarketingMetadata } from "@/lib/seo/marketing-metadata";
import Link from "next/link";
import { DemoIcon, FinalCta, MarketingPage, PrimaryLink, WorkingProductIntro } from "../MarketingComponents";
import { marketingCta } from "@/lib/analytics/marketing";
import MarketingFeaturettes from "../MarketingFeaturettes";
import MarketingPhoneShowcase from "../MarketingPhoneShowcase";
import RestaurantShowcases from "../RestaurantShowcases";
import { CTA_LABELS } from "../marketing-content";
import styles from "../page.module.css";
import MarketingIcon from "../MarketingIcon";

export const metadata = createMarketingMetadata("/work");

export default function WorkPage() {
  return (
    <MarketingPage>
      <section className={`${styles.subpageHero} ${styles.workHero}`}>
        <div>
          <h1>See Menu Man in action.</h1>
          <p>Explore Super Tacos, our interactive restaurant website demo. Browse the menu, try the ordering experience, and see what your customers could have at their fingertips.</p>
          <div className={styles.actionRow}>
            <PrimaryLink href="/r/super-tacos" ctaId="explore_product" placement="hero" icon={<DemoIcon />}>EXPLORE SUPER TACOS</PrimaryLink>
            <Link className={styles.secondaryLink} href="/build-my-website" {...marketingCta("build_website", "hero")}>{CTA_LABELS.showcase}</Link>
          </div>
          <p>Super Tacos is a fictional restaurant demo with simulated checkout.</p>
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
