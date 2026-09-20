import type { Metadata } from "next";
import Link from "next/link";
import {
  ArmandoDevice,
  FinalCta,
  MarketingPage,
  PrimaryLink,
  SectionHeading,
} from "./MarketingComponents";
import { NominationForm, ReviewButton } from "./MarketingInteractions";
import {
  CTA_LABELS,
  DINER_RESEARCH,
  faqs,
  guestQuestions,
  processSteps,
} from "./marketing-content";
import styles from "./page.module.css";

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
          <p className={styles.eyebrow}>Managed websites for restaurants</p>
          <h1>Get more customers with a better restaurant website.</h1>
          <p className={styles.heroLead}>
            Menu Man builds and manages your restaurant website so hungry customers can find what they need and choose you.
          </p>
          <div className={styles.actionRow}>
            <PrimaryLink />
            <ReviewButton className={styles.secondaryButton}>{CTA_LABELS.review}</ReviewButton>
          </div>
          <p className={styles.heroNote}>No website dashboard to learn. No new system for your staff to run.</p>
        </div>
        <div className={styles.heroVisual}>
          <ArmandoDevice />
          <span className={`${styles.productCallout} ${styles.calloutMenu}`}>Searchable menu</span>
          <span className={`${styles.productCallout} ${styles.calloutOrder}`}>Clear ordering path</span>
          <span className={`${styles.productCallout} ${styles.calloutDetails}`}>Hours &amp; location</span>
        </div>
      </section>

      <section className={styles.evidenceSection}>
        <div className={styles.evidenceCopy}>
          <p className={styles.eyebrow}>Before they choose</p>
          <h2>Your next customer is looking you up.</h2>
          <p>A strong restaurant can still lose the decision when its menu, hours, or website is hard to use.</p>
        </div>
        <div className={styles.stats}>
          <div><strong>{DINER_RESEARCH.menu}</strong><span>look at the menu online before choosing a new restaurant.</span></div>
          <div><strong>{DINER_RESEARCH.website}</strong><span>look at the restaurant&apos;s website.</span></div>
        </div>
        <a className={styles.sourceLink} href={DINER_RESEARCH.sourceUrl} target="_blank" rel="noreferrer">
          Source: {DINER_RESEARCH.sourceLabel} <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className={styles.questionsSection}>
        <SectionHeading
          eyebrow="The five-second check"
          title="Hungry customers are looking for a few simple answers."
          copy="Your website should answer them before someone taps back to search."
        />
        <div className={styles.questionBoard}>
          <ol>
            {guestQuestions.map((question, index) => (
              <li key={question}><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong></li>
            ))}
          </ol>
          <div className={styles.questionVisual} aria-label="Replaceable restaurant photography slot">
            <div className={styles.photoPlaceholder}>
              <span>Restaurant photography</span>
              <small>Replace with final client image</small>
            </div>
            <p>If those answers are hard to find, the next restaurant is one tap away.</p>
          </div>
        </div>
      </section>

      <section className={styles.processSection} id="how-it-works">
        <SectionHeading eyebrow="How it works" title="You run the restaurant. We'll handle the website." />
        <ol className={styles.processGrid}>
          {processSteps.map((step, index) => (
            <li key={step.title}>
              <span>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
        <Link className={styles.inlineLink} href="/services">See exactly what is included <span aria-hidden="true">&rarr;</span></Link>
      </section>

      <section className={styles.homeWorkSection}>
        <div className={styles.homeWorkCopy}>
          <p className={styles.eyebrow}>Working product</p>
          <h2>Armando&apos;s shows what the website can do.</h2>
          <p>A large menu becomes fast to search, easy to browse, and ready for a clear ordering path on any screen.</p>
          <ul>
            <li>Searchable menu</li>
            <li>Mobile-first browsing</li>
            <li>Ordering made obvious</li>
            <li>Hours and location close at hand</li>
          </ul>
          <div className={styles.actionRow}>
            <PrimaryLink href="/build-my-website?inspiredBy=armandos">↗ {CTA_LABELS.showcase}</PrimaryLink>
            <Link className={styles.secondaryLink} href="/work">Explore the work</Link>
          </div>
        </div>
        <div className={styles.homeWorkVisual}><ArmandoDevice mode="menu" /></div>
      </section>

      <section className={styles.reviewSection}>
        <div>
          <p className={styles.eyebrow}>A useful first step</p>
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
              <summary><span>{String(index + 1).padStart(2, "0")}</span>{faq.question}<b aria-hidden="true">+</b></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <FinalCta />

      <aside className={styles.nominationSection}>
        <div>
          <p className={styles.eyebrow}>Community referral</p>
          <h2>Know a great restaurant that needs a better website?</h2>
        </div>
        <NominationForm />
      </aside>
    </MarketingPage>
  );
}
