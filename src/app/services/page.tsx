import type { Metadata } from "next";
import {
  FinalCta,
  MarketingPage,
  PrimaryLink,
  SectionHeading,
} from "../MarketingComponents";
import { includedServices, laterServices, PUBLIC_PRICING, quotedServices } from "../marketing-content";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    "A complete managed restaurant website for $149 per month plus a $149 one-time setup, with menu updates, ordering connections, SEO basics, analytics, and support.",
};

export default function ServicesPage() {
  return (
    <MarketingPage>
      <section className={styles.subpageHero}>
        <div>
          <p className={styles.eyebrow}>Services &amp; Pricing</p>
          <h1>A complete restaurant website, managed for you.</h1>
          <p>Not a bare hosting plan. A clear website, a useful menu, routine updates, and a real person to help.</p>
        </div>
        <div className={styles.priceCard}>
          <span>Managed Restaurant Website</span>
          <strong>{PUBLIC_PRICING.monthly}</strong>
          <p>plus {PUBLIC_PRICING.setup}</p>
          <PrimaryLink />
        </div>
      </section>

      <section className={styles.includedSection}>
        <SectionHeading
          eyebrow="The core service"
          title="Everything the restaurant website needs to do its job."
          copy="The $149 plan is the finished product. You do not need an upgrade just to connect the ordering system you already use."
        />
        <div className={styles.includedGrid}>
          {includedServices.map((service, index) => (
            <div key={service}><span>{String(index + 1).padStart(2, "0")}</span><p>{service}</p></div>
          ))}
        </div>
      </section>

      <section className={styles.orderingSection}>
        <div>
          <p className={styles.eyebrow}>Keep what already works</p>
          <h2>Your ordering system does not have to change.</h2>
          <p>Menu Man can be the customer-facing website while Clover, Square, Toast, DoorDash, Uber Eats, or another provider keeps processing orders.</p>
        </div>
        <div className={styles.orderingPath} aria-label="Website connects customers to the restaurant's current ordering system">
          <span>Hungry customer</span><b aria-hidden="true">&rarr;</b><span>Menu Man website</span><b aria-hidden="true">&rarr;</b><span>Your ordering system</span>
        </div>
      </section>

      <section className={styles.scopeSection}>
        <SectionHeading eyebrow="A clear scope" title="What can be added later." />
        <div className={styles.scopeGrid}>
          {laterServices.map((service) => (
            <article key={service.title}>
              <span>{service.label}</span>
              <h3>{service.title}</h3>
              <p>{service.copy}</p>
            </article>
          ))}
          <article className={styles.futureCard}>
            <span>Future</span>
            <h3>Menu Man direct pickup ordering</h3>
            <p>Not part of the public offer today. Your existing ordering connection is included now.</p>
          </article>
        </div>
      </section>

      <section className={styles.quotedSection}>
        <div>
          <p className={styles.eyebrow}>Quoted separately</p>
          <h2>Bigger projects get a clear scope first.</h2>
        </div>
        <ul>
          {quotedServices.map((service) => <li key={service}>{service}</li>)}
        </ul>
      </section>

      <FinalCta />
    </MarketingPage>
  );
}
