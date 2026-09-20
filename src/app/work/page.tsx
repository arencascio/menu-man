import type { Metadata } from "next";
import Link from "next/link";
import { ArmandoDevice, FinalCta, MarketingPage, PrimaryLink } from "../MarketingComponents";
import { ArmandoGallery } from "../MarketingInteractions";
import { CTA_LABELS } from "../marketing-content";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Work",
  description: "Explore Menu Man's Armando's restaurant website demonstration across mobile, menu search, ordering, and practical visit details.",
};

export default function WorkPage() {
  return (
    <MarketingPage>
      <section className={`${styles.subpageHero} ${styles.workHero}`}>
        <div>
          <p className={styles.eyebrow}>Work / Product Gallery</p>
          <h1>One restaurant. A complete working demonstration.</h1>
          <p>Armando&apos;s is the first mature Menu Man showcase. No fake client wall, just a closer look at the product.</p>
          <div className={styles.actionRow}>
            <PrimaryLink href="/build-my-website?inspiredBy=armandos">↗ {CTA_LABELS.showcase}</PrimaryLink>
            <Link className={styles.secondaryLink} href="/r/armandos">View live restaurant site</Link>
          </div>
        </div>
        <div className={styles.workHeroVisual}><ArmandoDevice /></div>
      </section>

      <section className={styles.caseIntro}>
        <div><p className={styles.eyebrow}>Armando&apos;s</p><h2>A large menu made easier to use.</h2></div>
        <p>The showcase keeps the restaurant&apos;s own character while making the practical customer journey clear on desktop and mobile.</p>
      </section>

      <section className={styles.gallerySection}>
        <ArmandoGallery />
      </section>

      <section className={styles.galleryCta}>
        <p>Want this kind of clarity for your restaurant?</p>
        <PrimaryLink href="/build-my-website?inspiredBy=armandos">↗ {CTA_LABELS.showcase}</PrimaryLink>
      </section>

      <FinalCta />
    </MarketingPage>
  );
}
