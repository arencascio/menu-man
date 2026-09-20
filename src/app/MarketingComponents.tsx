import Image from "next/image";
import Link from "next/link";
import { CTA_LABELS } from "./marketing-content";
import { MarketingHeader, ReviewButton, ReviewModal } from "./MarketingInteractions";
import styles from "./page.module.css";

export { default as ArmandoDevice } from "./ArmandoDevice";

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={styles.brand} href="/" aria-label="Menu Man home">
      <span className={`${styles.logoFrame} ${compact ? styles.logoFrameCompact : ""}`}>
        <Image src="/brand/menu-man-phone.png" alt="" width={800} height={800} priority={!compact} />
      </span>
      <span>
        <strong>MENU MAN</strong>
        {!compact ? <small>Restaurant websites</small> : null}
      </span>
    </Link>
  );
}

export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <MarketingHeader brand={<BrandLockup />} />
      <main>{children}</main>
      <MarketingFooter />
      <ReviewModal />
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`${styles.sectionHeading} ${align === "center" ? styles.sectionHeadingCenter : ""}`}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      {copy ? <p className={styles.sectionLead}>{copy}</p> : null}
    </div>
  );
}

export function PrimaryLink({
  children = CTA_LABELS.primary,
  href = "/build-my-website",
  light = false,
}: {
  children?: React.ReactNode;
  href?: string;
  light?: boolean;
}) {
  return (
    <Link className={`${styles.primaryButton} ${light ? styles.primaryButtonLight : ""}`} href={href}>
      <span>{children}</span>
      <span aria-hidden="true">&rarr;</span>
    </Link>
  );
}

export function FinalCta() {
  return (
    <section className={styles.finalCta}>
      <div>
        <p className={styles.eyebrow}>Ready when you are</p>
        <h2>Let&apos;s make your website feel as welcoming as your front door.</h2>
      </div>
      <div className={styles.finalCtaActions}>
        <PrimaryLink light />
        <ReviewButton className={styles.reviewButtonDark}>{CTA_LABELS.review}</ReviewButton>
      </div>
    </section>
  );
}

function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerMain}>
        <div>
          <BrandLockup compact />
          <p>Restaurant websites, built and kept current.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/#how-it-works">How It Works</Link>
          <Link href="/services">Services &amp; Pricing</Link>
          <Link href="/work">Work</Link>
          <Link href="/build-my-website">Build My Website</Link>
        </nav>
        <div className={styles.footerContact}>
          <ReviewButton className={styles.footerReview}>Free Website Review</ReviewButton>
          <a href="mailto:hello@getmenuman.com">hello@getmenuman.com</a>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>&copy; {new Date().getFullYear()} GetMenuMan.com</span>
        <span>Built for restaurants.</span>
      </div>
    </footer>
  );
}
