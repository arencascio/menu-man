import type { Metadata } from "next";
import Image from "next/image";
import { FinalCta, MarketingPage, PrimaryLink } from "../MarketingComponents";
import { ProductGallery } from "../MarketingInteractions";
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
          <p>Different restaurants, distinct personalities. Explore how thoughtful menus, photography, and clear information help customers find their next favorite.</p>
          <div className={styles.actionRow}>
            <PrimaryLink ctaId="site_like_this" placement="hero">↗ {CTA_LABELS.showcase}</PrimaryLink>
          </div>
        </div>
        <div className={styles.workHeroVisual}><Image className={styles.brandArtwork} src="/brand/MenuManPhone.svg" alt="Menu Man's phone and chef-hat illustration" width={469.387} height={923.785} loading="eager" /></div>
      </section>

      <section className={styles.gallerySection}>
        <RestaurantShowcases />
        <div className={styles.workCapabilities}>
          <ProductGallery />
        </div>
      </section>

      <section className={styles.galleryCta}>
        <MarketingIcon name="sparkles" size={36} />
        <p>Want this kind of clarity for your restaurant?</p>
        <PrimaryLink ctaId="site_like_this">↗ {CTA_LABELS.showcase}</PrimaryLink>
      </section>

      <FinalCta />
    </MarketingPage>
  );
}
