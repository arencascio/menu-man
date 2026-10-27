import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { upperCrust } from "@/lib/upper-crust/config";
import { upperCrustLinks } from "@/lib/upper-crust/site-content";
import { upperCrustRequestAllowed } from "@/lib/upper-crust/access";
import { isUpperCrustPreviewPresentation } from "@/lib/upper-crust/preview-presentation";
import { resolveTheme } from "@/lib/themes/resolve-theme";
import styles from "./upper-crust.module.css";
import SiteNavigation from "./SiteNavigation";
import BrickWall from "./BrickWall";
import { upperCrustStoke } from "./upper-crust-font";

export const metadata: Metadata = {
  title: { absolute: "Upper Crust · Private Menu Man concept" },
  description: "Private, unofficial restaurant website concept. All orders are simulated.",
  robots: { index: false, follow: false, noarchive: true, googleBot: { index: false, follow: false, noimageindex: true } },
};
export const dynamic = "force-dynamic";

function SiteLinks({ primary = false }: { primary?: boolean }) {
  return <>
    <Link href="/r/upper-crust/menu">Menu</Link>
    <Link href="/r/upper-crust/about">About Us</Link>
    <Link href="/r/upper-crust/catering">Catering</Link>
    <a href={upperCrust.providerUrl} target="_blank" rel="noopener noreferrer nofollow">Delivery ↗</a>
    <a href={upperCrustLinks.directions} target="_blank" rel="noopener noreferrer nofollow">Directions <span aria-hidden="true">↗</span></a>
    <Link className={primary ? styles.navCta : undefined} href="/r/upper-crust/menu?item=uc-custom">Build a Sandwich</Link>
  </>;
}

export default async function UpperCrustLayout({ children }: { children: ReactNode }) {
  const host = (await headers()).get("host") || "";
  if (!upperCrustRequestAllowed(process.env, host)) notFound();
  const previewPresentation = isUpperCrustPreviewPresentation();
  const theme = resolveTheme(null, upperCrust.theme);
  const tokens = Object.fromEntries(Object.entries(theme.colors).map(([key, value]) => [`--theme-${key === "mutedText" ? "muted-text" : key}`, value]));
  return <div className={`${styles.site} ${upperCrustStoke.variable}`} data-protected-preview={previewPresentation ? "true" : undefined} style={{ ...tokens, "--theme-heading-font": theme.typography.headingFont, "--theme-body-font": theme.typography.bodyFont } as CSSProperties}>
    <BrickWall id="site-bricks" className={styles.siteMasonry}/>
    <a className={styles.skip} href="#main-content">Skip to content</a>
    <header className={styles.header}>
      <Link href="/r/upper-crust" className={styles.wordmark} aria-label={`${upperCrust.name} concept home`}><Image src="/r/upper-crust/media/upper-crust.png" alt="The Upper Crust" width={1797} height={230} unoptimized loading="eager"/><span>SANDWICH SHOPPE · DOWNTOWN RIVERSIDE</span></Link>
      <SiteNavigation/>
    </header>
    {children}
    <footer className={styles.footer}>
      <div className={styles.footerBrand}><Link href="/r/upper-crust" aria-label="Upper Crust home"><Image src="/r/upper-crust/media/upper-crust.png" alt="The Upper Crust" width={1797} height={230} unoptimized/></Link></div>
      <nav aria-label="Footer navigation"><SiteLinks/></nav>
      <div className={styles.footerContact}><p>{upperCrust.address}<br/>{upperCrust.locality}</p><a href={upperCrustLinks.phone}>{upperCrust.phone}</a><div className={styles.footerSocial}><a href={upperCrustLinks.facebook} target="_blank" rel="noopener noreferrer nofollow">Facebook ↗</a><a href={upperCrustLinks.instagram} target="_blank" rel="noopener noreferrer nofollow">Instagram ↗</a></div></div>
      <span>{upperCrust.disclosure}<br/>Private prospect concept · Menu Man</span>
    </footer>
  </div>;
}
