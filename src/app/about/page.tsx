import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingPage } from "../MarketingComponents";
import { PUBLIC_CONTACT } from "../marketing-content";
import { isBusinessPageAvailable } from "@/lib/marketing-business-pages";
import styles from "../business-information.module.css";

export const metadata: Metadata = {
  title: "About Menu Man — Review Draft",
  description: "Meet the person behind Menu Man. Local draft awaiting owner-supplied founder details.",
  robots: { index: false, follow: false },
};

export default function AboutMenuManPage() {
  if (!isBusinessPageAvailable("about")) notFound();
  return <MarketingPage>
    <div className={styles.page}>
      <aside className={styles.review} aria-label="Publication review status">
        <strong>Draft — owner review required</strong>
        <p>The founder name, personal introduction, headshot and LinkedIn URL still need owner confirmation. This page is not published.</p>
      </aside>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>About Menu Man</p>
        <h1>The person behind Menu Man.</h1>
        <p>A useful website should help people choose your restaurant and make the important details easy to find.</p>
      </header>
      <div className={styles.aboutGrid}>
        <div>
          <div className={styles.headshot} role="img" aria-label="Placeholder for an owner-supplied founder headshot"><span>Owner headshot to come</span></div>
          <p className={styles.placeholder}>Founder name and introduction awaiting owner confirmation.</p>
          <span className={styles.pending} aria-disabled="true">LinkedIn profile — owner URL needed</span>
        </div>
        <div className={styles.aboutCopy}>
          <h2>Why Menu Man exists</h2>
          <p>Menu Man is built around a practical idea: independent restaurant owners should be able to keep a strong online presence without taking on the website work themselves.</p>
          <p>The focus is a clear, mobile-friendly website with an accurate menu, hours, location and ordering path, backed by routine updates and direct human support.</p>
          <h2>Let’s talk about your restaurant.</h2>
          <p>Have a question about your website or an update that keeps getting put off? Start with an email.</p>
          <a className={styles.contact} href={`mailto:${PUBLIC_CONTACT.email}`}>Email the person behind Menu Man <span aria-hidden="true">↗</span></a>
          <p className={styles.email}>{PUBLIC_CONTACT.email}</p>
        </div>
      </div>
    </div>
  </MarketingPage>;
}
