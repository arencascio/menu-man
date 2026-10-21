import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingPage } from "../MarketingComponents";
import { PUBLIC_CONTACT, PUBLIC_PRICING } from "../marketing-content";
import { cancellationTopics } from "../business-review-content";
import { isBusinessPageAvailable } from "@/lib/marketing-business-pages";
import styles from "../business-information.module.css";

export const metadata: Metadata = {
  title: "Cancellation & Data Handoff — Review Draft",
  description: "Menu Man working cancellation and data handoff policy, awaiting separate publication approval.",
  robots: { index: false, follow: false },
};

export default function CancellationPage() {
  if (!isBusinessPageAvailable("cancellation")) notFound();
  return <MarketingPage>
    <div className={styles.page}>
      <aside className={styles.review} aria-label="Publication review status">
        <strong>Working policy approved — publication pending</strong>
        <p>These terms have owner approval as working business policy. This local copy remains gated for release review.</p>
      </aside>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Cancellation & data handoff</p>
        <h1>What happens if I cancel?</h1>
        <p>You stay in control of your domain and restaurant information. If you decide to move on, here’s how the handoff works.</p>
        <a className={styles.contact} href={`mailto:${PUBLIC_CONTACT.email}`}>Talk to Menu Man about a handoff <span aria-hidden="true">↗</span></a>
      </header>
      <div className={styles.topics}>
        {cancellationTopics.map((topic, index) => <section key={topic.id} id={topic.id} className={styles.topic}>
          <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
          <div><h2>{topic.title}</h2><p>{topic.copy}</p></div>
        </section>)}
      </div>
      <section className={styles.nextStep}>
        <h2>Questions before you decide?</h2>
        <p>Email <a href={`mailto:${PUBLIC_CONTACT.email}`}>{PUBLIC_CONTACT.email}</a>. Ask about your domain, the information you need, and your next website.</p>
        <p>The managed website plan is {PUBLIC_PRICING.monthly} plus a {PUBLIC_PRICING.startupFee} one-time startup fee.</p>
        <p className={styles.scopeNote}>The export covers your restaurant information. Menu Man’s proprietary source code, hosted system and templates stay with Menu Man. Custom migration work is separate from the standard export.</p>
        <Link href="/services">Back to Services & Pricing <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  </MarketingPage>;
}
