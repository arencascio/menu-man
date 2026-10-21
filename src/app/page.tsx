import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  FinalCta,
  MarketingPage,
  PrimaryLink,
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
          <Image className={styles.brandArtwork} src="/brand/MenuManPhone.svg" alt="Menu Man's phone and chef-hat illustration" width={469.387} height={923.785} loading="eager" />
          <span className={`${styles.productCallout} ${styles.calloutMenu}`}>Searchable menu</span>
          <span className={`${styles.productCallout} ${styles.calloutOrder}`}>Clear ordering path</span>
          <span className={`${styles.productCallout} ${styles.calloutDetails}`}>Hours &amp; location</span>
        </div>
      </section>

      <section className={styles.evidenceSection}>
        <div className={styles.evidenceCopy}>
          <h2>Your next customer is looking you up.</h2>
          <p>A strong restaurant can still lose the decision when its menu, hours, or website is hard to use.</p>
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
          title="Hungry customers are looking for a few simple answers."
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
        <MarketingReveal as="ol" className={styles.processGrid}>
          {processSteps.map((step, index) => (
            <li key={step.title}>
              <div className={styles.processTop}><span>{String(index + 1).padStart(2, "0")}</span><span data-reveal-item><MarketingIcon name={processIcons[index]} size={36} /></span></div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </MarketingReveal>
        <Link className={styles.inlineLink} href="/services" {...marketingCta("services_pricing", "section")}>See exactly what is included <span aria-hidden="true">&rarr;</span></Link>
      </section>

      <section className={styles.homeWorkSection}>
        <div className={styles.homeWorkCopy}>
          <p className={styles.eyebrow}>Working product</p>
          <h2>A restaurant website built around your customers.</h2>
          <p>A large menu becomes fast to search, easy to browse, and ready for a clear ordering path on any screen.</p>
          <p>Explore a fictional, photo-led restaurant demonstration with a searchable menu and interactive customization.</p>
          <div className={styles.actionRow}>
            <PrimaryLink ctaId="site_like_this">↗ {CTA_LABELS.showcase}</PrimaryLink>
            <Link className={styles.secondaryLink} href="/work" {...marketingCta("explore_product", "section")}>Explore the product</Link>
          </div>
        </div>
        <MarketingCapabilities />
        <RestaurantShowcases compact />
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
