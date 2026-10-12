import type { Metadata } from "next";
import Image from "next/image";
import { FinalCta, MarketingPage, PrimaryLink } from "../MarketingComponents";
import { ProductGallery } from "../MarketingInteractions";
import { CTA_LABELS } from "../marketing-content";
import styles from "../page.module.css";

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
          <p>Explore the capabilities of a managed restaurant website. This illustrated product overview uses Menu Man&apos;s own artwork.</p>
          <div className={styles.actionRow}>
            <PrimaryLink>↗ {CTA_LABELS.showcase}</PrimaryLink>
          </div>
        </div>
        <div className={styles.workHeroVisual}><Image className={styles.brandArtwork} src="/brand/menu-man-phone.png" alt="Menu Man's phone and chef-hat illustration" width={800} height={800} priority /></div>
      </section>

      <section className={styles.caseIntro}>
        <div><h2>A large menu made easier to use.</h2></div>
        <p>Your restaurant keeps its own character while customers find the menu, ordering links, and visit details on desktop and mobile.</p>
      </section>

      <section className={styles.gallerySection}>
        <ProductGallery />
      </section>

      <section className={styles.galleryCta}>
        <p>Want this kind of clarity for your restaurant?</p>
        <PrimaryLink>↗ {CTA_LABELS.showcase}</PrimaryLink>
      </section>

      <FinalCta />
    </MarketingPage>
  );
}
