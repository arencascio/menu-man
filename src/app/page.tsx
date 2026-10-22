import type { Metadata } from "next";
import Link from "next/link";
import {
  FinalCta,
  MarketingPage,
  PrimaryLink,
  WorkingProductIntro,
  SectionHeading,
} from "./MarketingComponents";
import { ReviewButton } from "./MarketingInteractions";
import RestaurantShowcases from "./RestaurantShowcases";
import {
  CTA_LABELS,
  DINER_RESEARCH,
  faqs,
  guestQuestions,
  processSteps,
} from "./marketing-content";
import styles from "./page.module.css";
import { marketingCta } from "@/lib/analytics/marketing";
import MarketingIcon, { type MarketingIconName } from "./MarketingIcon";
import MarketingReveal from "./MarketingReveal";
import MarketingCapabilities from "./MarketingCapabilities";
import MarketingPhoneShowcase from "./MarketingPhoneShowcase";

const questionIcons: MarketingIconName[] = ["utensils", "dollar", "moon", "map", "cart"];
const processIcons: MarketingIconName[] = ["message", "globe", "history"];

export const metadata: Metadata = {
  title: "Restaurant Websites That Help You Get Chosen | Menu Man",
  description:
    "Menu Man builds and manages restaurant websites with clear menus, ordering paths, hours, location details, and ongoing updates.",
};

export default function Home() {
  return (
    <MarketingPage>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1>Get more customers with a better restaurant website.</h1>
          <p className={styles.heroLead}>
            Menu Man builds and manages your restaurant website so hungry customers can find what they need and choose you.
          </p>
          <div className={styles.actionRow}>
            <PrimaryLink placement="hero" />
            <ReviewButton placement="hero" className={styles.secondaryButton}>{CTA_LABELS.review}</ReviewButton>
          </div>
          <p className={styles.heroNote}>No website dashboard to learn. No new system for your staff to run.</p>
        </div>
        <div className={styles.heroVisual}>
          <MarketingPhoneShowcase />
        </div>
      </section>

      <section className={styles.evidenceSection}>
        <div className={styles.evidenceCopy}>
          <h2>Customers look online before they choose.</h2>
          <p>A great restaurant can still lose a customer when its menu, hours, or ordering options are hard to find.</p>
        </div>
        <MarketingReveal className={styles.stats}>
          <div data-reveal-item><span className={styles.statNumber}>01</span><strong>{DINER_RESEARCH.menu}</strong><span>look at the menu online before choosing a new restaurant.</span></div>
          <div data-reveal-item><span className={styles.statNumber}>02</span><strong>{DINER_RESEARCH.website}</strong><span>look at the restaurant&apos;s website.</span></div>
        </MarketingReveal>
        <a className={styles.sourceLink} href={DINER_RESEARCH.sourceUrl} target="_blank" rel="noreferrer">
          Source: {DINER_RESEARCH.sourceLabel} <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className={styles.questionsSection}>
        <SectionHeading
          title="Give customers what they're looking for."
          copy="Your website should answer them before someone taps back to search."
        />
        <div className={styles.questionBoard}>
          <MarketingReveal as="ol">
            {guestQuestions.map((question, index) => (
              <li key={question} data-reveal-item><span>{String(index + 1).padStart(2, "0")}</span><MarketingIcon name={questionIcons[index]} size={24} /><strong>{question}</strong></li>
            ))}
          </MarketingReveal>
          <div className={styles.questionVisual}>
            <MarketingIcon name="smile" size={34} />
            <p>If those answers are hard to find, the next restaurant is one tap away.</p>
          </div>
        </div>
      </section>

      <section className={styles.processSection} id="how-it-works">
        <SectionHeading title="You run the restaurant. We'll handle the website." />
        <MarketingReveal as="ol" className={styles.processGrid} variant="process">
          {processSteps.map((step, index) => (
            <li key={step.title} data-reveal-item>
              <div className={styles.processTop}><span>{String(index + 1).padStart(2, "0")}</span><span><MarketingIcon name={processIcons[index]} size={36} /></span></div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </MarketingReveal>
        <Link className={styles.inlineLink} href="/services" {...marketingCta("services_pricing", "section")}>See exactly what is included <span aria-hidden="true">&rarr;</span></Link>
      </section>

      <section className={styles.homeWorkSection}>
        <WorkingProductIntro />
        <RestaurantShowcases compact />
        <MarketingCapabilities />
      </section>

      <section className={styles.reviewSection}>
        <div>
          <h2>See how your restaurant looks online.</h2>
          <p>We will look at the menu, mobile experience, hours, location, and ordering path, then point out what matters most.</p>
        </div>
        <ReviewButton className={styles.reviewSectionButton}>{CTA_LABELS.review} <span aria-hidden="true">&rarr;</span></ReviewButton>
      </section>

      <section className={styles.faqSection}>
        <SectionHeading eyebrow="Common questions" title="The practical details." />
        <div className={styles.faqList}>
          {faqs.map((faq, index) => (
            <details key={faq.question}>
              <summary><span>{String(index + 1).padStart(2, "0")}</span>{faq.question}<MarketingIcon name="chevron" size={22} className={styles.disclosureChevron} /></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <FinalCta />
    </MarketingPage>
  );
}
