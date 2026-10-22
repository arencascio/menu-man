import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingPage } from "../MarketingComponents";
import { PUBLIC_CONTACT } from "../marketing-content";
import { cancellationTopics } from "../business-review-content";
import { isBusinessPageAvailable } from "@/lib/marketing-business-pages";
import styles from "../business-information.module.css";

export const metadata: Metadata = {
  title: "Cancellation & Data Handoff",
  description: "What to expect when ending Menu Man’s managed restaurant website service.",
};

export default function CancellationPage() {
  if (!isBusinessPageAvailable("cancellation")) notFound();
  return <MarketingPage>
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Cancellation & data handoff</p>
        <h1>What happens if I cancel?</h1>
        <p>If you decide to move on, we’ll help you plan the next steps for your website and information.</p>
        <a className={styles.contact} href={`mailto:${PUBLIC_CONTACT.email}`}>Talk to Menu Man about a handoff <span aria-hidden="true">↗</span></a>
      </header>
      <div className={styles.topics}>
        {cancellationTopics.map((topic, index) => <section key={topic.id} id={topic.id} className={styles.topic}>
          <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
          <div><h2>{topic.title}</h2><p>{topic.copy}</p></div>
        </section>)}
      </div>
      <section className={styles.nextStep}>
        <h2>Need a hand?</h2>
        <p>Email <a href={`mailto:${PUBLIC_CONTACT.email}`}>{PUBLIC_CONTACT.email}</a> to request cancellation or talk through your handoff.</p>
        <Link href="/services">Back to Services & Pricing <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  </MarketingPage>;
}
