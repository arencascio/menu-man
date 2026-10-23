import { marketingOrganization } from "@/lib/seo/marketing-metadata";
import Image from "next/image";
import Link from "next/link";
import { CTA_LABELS, PUBLIC_CONTACT } from "./marketing-content";
import { MarketingHeader, ReviewButton, ReviewModal } from "./MarketingInteractions";
import styles from "./page.module.css";
import { marketingCta } from "@/lib/analytics/marketing";
import type { MarketingCta, MarketingPlacement } from "@/lib/analytics/types";
import MarketingIcon from "./MarketingIcon";
import MarketingReveal from "./MarketingReveal";
import { getBusinessPageHref } from "@/lib/marketing-business-pages";

export function DemoIcon() {
  return <Image src="/img/icons/square-play.svg" alt="" aria-hidden="true" width={22} height={22} className={styles.demoIcon} />;
}

export function WorkingProductIntro() {
  return <div className={styles.homeWorkCopy} data-working-product>
    <p className={styles.eyebrow}>Working product</p>
    <h2>See Menu Man in action</h2>
    <p>This is a working restaurant demo, not a mockup. Go ahead, click around.</p>
    <div className={styles.actionRow}>
      <PrimaryLink href="/r/super-tacos" ctaId="site_like_this" icon={<DemoIcon />}>EXPLORE LIVE DEMO</PrimaryLink>
      <Link className={styles.secondaryLink} href="/build-my-website" {...marketingCta("build_website", "section")}>I WANT A SITE LIKE THIS</Link>
    </div>
  </div>;
}

export function BrandLockup({ placement = "navigation" }: { placement?: "navigation" | "footer" }) {
  const navigation = placement === "navigation";
  return (
    <Link className={styles.brand} href="/" aria-label="Menu Man home">
      <span className={`${styles.logoFrame} ${navigation ? "" : styles.logoFrameLarge}`}>
        {navigation ? <Image src="/brand/MenuManPhoneSmol.svg" alt="" width={469.387} height={530.246} loading="eager" /> :
          <MarketingReveal as="span" variant="footer" className={styles.footerLogoMotion} durationMs={1500} turnDegrees={-75}>
            <span data-reveal-item><Image src="/brand/MenuManPhone.svg" alt="" width={469.387} height={923.785} loading="lazy" /></span>
          </MarketingReveal>}
      </span>
      <span>
        <strong>MENU MAN</strong>
        {navigation ? <small>Restaurant websites</small> : null}
      </span>
    </Link>
  );
}

export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page} data-marketing-page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(marketingOrganization) }} />
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
  eyebrow?: string;
  title: string;
  copy?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`${styles.sectionHeading} ${align === "center" ? styles.sectionHeadingCenter : ""}`}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h2>{title}</h2>
      {copy ? <p className={styles.sectionLead}>{copy}</p> : null}
    </div>
  );
}

export function PrimaryLink({
  children = CTA_LABELS.primary,
  href = "/build-my-website",
  light = false,
  ctaId = "build_website",
  placement = "section",
  icon,
}: {
  children?: React.ReactNode;
  href?: string;
  light?: boolean;
  ctaId?: MarketingCta;
  placement?: MarketingPlacement;
  icon?: React.ReactNode;
}) {
  return (
    <Link className={`${styles.primaryButton} ${light ? styles.primaryButtonLight : ""}`} href={href} {...marketingCta(ctaId, placement)}>
      <span>{children}</span>
      {icon ?? <span aria-hidden="true">&rarr;</span>}
    </Link>
  );
}

export function FinalCta() {
  return (
    <section className={styles.finalCta}>
      <MarketingReveal className={styles.finalCtaInner}>
        <div data-reveal-item><MarketingIcon name="heart" size={44} className={styles.lightIcon} /></div>
        <div data-reveal-item>
          <h2>Let&apos;s make your website feel as welcoming as your front door.</h2>
          <p>A clear, welcoming website. A real person to keep it current.</p>
        </div>
        <div className={styles.finalCtaActions} data-reveal-item>
          <PrimaryLink light placement="final_cta" />
          <ReviewButton placement="final_cta" className={styles.reviewButtonDark}>{CTA_LABELS.review}</ReviewButton>
        </div>
      </MarketingReveal>
    </section>
  );
}

function MarketingFooter() {
  const cancellationHref = getBusinessPageHref("cancellation");
  const aboutHref = getBusinessPageHref("about");
  return (
    <footer className={styles.footer}>
      <div className={styles.footerMain}>
        <div>
          <BrandLockup placement="footer" />
          <p>Restaurant websites, built and kept current.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/#how-it-works">How It Works</Link>
          <Link href="/services" {...marketingCta("services_pricing", "footer")}>Services &amp; Pricing</Link>
          <Link href="/work" {...marketingCta("explore_product", "footer")}>Work</Link>
          <Link href="/build-my-website" {...marketingCta("build_website", "footer")}>Build My Website</Link>
          {aboutHref ? <Link href={aboutHref}>About Menu Man</Link> : null}
          {cancellationHref ? <Link href={cancellationHref}>Cancellation &amp; data handoff</Link> : null}
        </nav>
        <div className={styles.footerContact}>
          <ReviewButton placement="footer" className={styles.footerReview}>Free Website Review</ReviewButton>
          <a href={`mailto:${PUBLIC_CONTACT.email}`} data-marketing-email="general" data-marketing-placement="footer">{PUBLIC_CONTACT.email}</a>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>&copy; {new Date().getFullYear()} GetMenuMan.com</span>
        <span>Built for restaurants.</span>
      </div>
    </footer>
  );
}
