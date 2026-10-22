import type { Metadata } from "next";
import Link from "next/link";
import { getBusinessPageHref } from "@/lib/marketing-business-pages";
import {
  FinalCta,
  MarketingPage,
  PrimaryLink,
  SectionHeading,
} from "../MarketingComponents";
import { includedServices, optionalServices, PUBLIC_PRICING, quotedServices } from "../marketing-content";
import styles from "../page.module.css";
import MarketingIcon, { type MarketingIconName } from "../MarketingIcon";

const serviceIcons: MarketingIconName[] = ["phone", "globe", "store", "menu", "list", "calendar", "cart", "message", "chart", "smile"];

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    `Managed restaurant websites for ${PUBLIC_PRICING.monthly} plus a ${PUBLIC_PRICING.startupFee} one-time startup fee. Includes searchable menus, routine updates, and existing ordering links.`,
};

export default function ServicesPage() {
  const cancellationHref = getBusinessPageHref("cancellation");
  return (
    <MarketingPage>
      <section className={styles.subpageHero}>
        <div>
          <MarketingIcon name="platter" size={44} />
          <h1>A complete restaurant website, managed for you.</h1>
          <p>Not a bare hosting plan. A clear website, a useful menu, routine updates, and a real person to help.</p>
        </div>
        <div className={styles.priceCard}>
          <h2>Managed Restaurant Website</h2>
          <strong>{PUBLIC_PRICING.monthly}</strong>
          <p className={styles.startupFee}>{PUBLIC_PRICING.startupFee} one-time startup fee</p>
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
            <div key={service}><span>{String(index + 1).padStart(2, "0")}</span><MarketingIcon name={serviceIcons[index]} size={26} /><p>{service}</p></div>
          ))}
        </div>
      </section>

      <section className={styles.orderingSection} data-ordering-ecosystem>
        <div>
          <h2>Your ordering setup does not have to change.</h2>
          <p>Keep Square and the other tools you already use. Menu Man becomes the customer-facing website while your current ordering workflow stays in place.</p>
        </div>
        <ul className={styles.providerStrip} tabIndex={0} aria-label="Examples of existing restaurant ordering providers">
          {["Square", "Clover", "Toast", "DoorDash", "Uber Eats", "Grubhub"].map((provider) => <li key={provider} data-featured={provider === "Square"}>{provider}</li>)}
        </ul>
      </section>

      <section className={styles.scopeSection}>
        <SectionHeading title="Optional help, when you need it." />
        <div className={styles.scopeGrid}>
          {optionalServices.map((service, index) => (
            <article key={service.title}>
              <span className={styles.optionalLabel}>Optional add-on</span>
              <MarketingIcon name={index === 0 ? "truck" : "chef"} size={34} />
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

      <section className={styles.cancellationEntry} aria-labelledby="cancellation-title">
        <h2 id="cancellation-title">Know what comes next.</h2>
        {cancellationHref ? <Link href={cancellationHref} aria-describedby="cancellation-pending">What happens if I cancel?</Link> : <button type="button" disabled aria-describedby="cancellation-pending">What happens if I cancel?</button>}
        <p id="cancellation-pending">Cancellation and data handoff information is awaiting publication approval.</p>
      </section>

      <FinalCta />
    </MarketingPage>
  );
}
