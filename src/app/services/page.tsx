import type { Metadata } from "next";
import {
  FinalCta,
  MarketingPage,
  PrimaryLink,
  SectionHeading,
} from "../MarketingComponents";
import { includedServices, optionalServices, PUBLIC_PRICING, quotedServices } from "../marketing-content";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    `A complete managed restaurant website for ${PUBLIC_PRICING.monthly}, with menu updates, existing ordering links, basic analytics, and direct support.`,
};

export default function ServicesPage() {
  return (
    <MarketingPage>
      <section className={styles.subpageHero}>
        <div>
          <h1>A complete restaurant website, managed for you.</h1>
          <p>Not a bare hosting plan. A clear website, a useful menu, routine updates, and a real person to help.</p>
        </div>
        <div className={styles.priceCard}>
          <h2>Managed Restaurant Website</h2>
          <strong>{PUBLIC_PRICING.monthly}</strong>
          <PrimaryLink placement="hero" />
        </div>
      </section>

      <section className={styles.includedSection}>
        <SectionHeading
          eyebrow="The core service"
          title="Everything the restaurant website needs to do its job."
          copy={`The ${PUBLIC_PRICING.monthly} plan is the complete core service. Your existing ordering links and basic analytics are included.`}
        />
        <div className={styles.includedGrid}>
          {includedServices.map((service, index) => (
            <div key={service}><span>{String(index + 1).padStart(2, "0")}</span><p>{service}</p></div>
          ))}
        </div>
      </section>

      <section className={styles.orderingSection}>
        <div>
          <h2>Your ordering system does not have to change.</h2>
          <p>Menu Man can be the customer-facing website while Clover, Square, Toast, DoorDash, Uber Eats, or another provider keeps processing orders.</p>
          <p>You can keep your existing ordering provider with no Menu Man per-order fee.</p>
        </div>
        <div className={styles.orderingPath} aria-label="Website connects customers to the restaurant's current ordering system">
          <span>Hungry customer</span><b aria-hidden="true">&rarr;</b><span>Menu Man website</span><b aria-hidden="true">&rarr;</b><span>Your ordering system</span>
        </div>
      </section>

      <section className={styles.scopeSection}>
        <SectionHeading title="Optional help, when you need it." />
        <div className={styles.scopeGrid}>
          {optionalServices.map((service) => (
            <article key={service.title}>
              <h3>{service.title}</h3>
              <p className={styles.optionalPrice}>{service.price}</p>
              <p>{service.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.quotedSection}>
        <div>
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
