import type { Metadata } from "next";
import Link from "next/link";
import {
  armandoProof,
  CTA_LABELS,
  faqs,
  guestQuestions,
  heroPromises,
  journeySteps,
  marketingCopy,
  mockupCallouts,
  outcomes,
  processSteps,
  reviewCriteria,
  routineUpdates,
  services,
} from "./marketing-content";
import { DemoForm, MarketingHeader, Reveal } from "./MarketingInteractions";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Menu Man | Restaurant Websites Built & Managed for You",
  description:
    "Menu Man builds and manages modern websites for independent restaurants, including menus, routine updates, ordering connections, and reporting options.",
};

const Arrow = () => <span aria-hidden="true">↗</span>;

function SectionIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className={styles.sectionIntro}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      {copy ? <p className={styles.sectionCopy}>{copy}</p> : null}
    </div>
  );
}

function ProductMockup({ showCallouts = false }: { showCallouts?: boolean }) {
  const calloutClasses = [styles.calloutOne, styles.calloutTwo, styles.calloutThree, styles.calloutFour];

  return (
    <div
      className={styles.mockupStage}
      aria-label="Preview of the Armando’s restaurant website on desktop and mobile"
    >
      <div className={styles.browserMockup}>
        <div className={styles.browserBar}>
          <span />
          <span />
          <span />
          <div>getmenuman.com/r/armandos</div>
        </div>
        <div className={styles.restaurantSite}>
          <nav>
            <strong>ARMANDO&apos;S</strong>
            <span>Menu &nbsp; Our story &nbsp; Visit</span>
          </nav>
          <div className={styles.restaurantHero}>
            <p>FAMILY RECIPES · FRESH EVERY DAY</p>
            <h3>
              Good food.
              <br />
              Made together.
            </h3>
            <span className={styles.mockButton}>Explore the menu</span>
          </div>
          <div className={styles.dishRow}>
            <div>
              <span>01</span>
              <strong>House favorites</strong>
            </div>
            <div>
              <span>02</span>
              <strong>Freshly made</strong>
            </div>
            <div>
              <span>03</span>
              <strong>Order pickup</strong>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.phoneMockup}>
        <div className={styles.phoneSpeaker} />
        <div className={styles.phoneScreen}>
          <div className={styles.phoneNav}>
            <strong>A</strong>
            <span>☰</span>
          </div>
          <div className={styles.phoneHero}>
            <small>WELCOME TO</small>
            <strong>Armando&apos;s</strong>
            <span>View menu</span>
          </div>
          <div className={styles.phoneMenu}>
            <small>POPULAR</small>
            <b>House Special</b>
            <p>Made fresh to order</p>
          </div>
        </div>
      </div>
      <div className={styles.careBadge}>
        <span>✓</span>
        <div>
          <strong>Menu updated</strong>
          <small>Handled by Menu Man</small>
        </div>
      </div>
      {showCallouts
        ? mockupCallouts.map((callout, index) => (
            <div className={`${styles.mockupCallout} ${calloutClasses[index]}`} key={callout}>
              <span aria-hidden="true" />
              {callout}
            </div>
          ))
        : null}
    </div>
  );
}

export default function Home() {
  return (
    <main className={styles.page}>
      <MarketingHeader />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{marketingCopy.hero.eyebrow}</p>
          <h1>{marketingCopy.hero.title}</h1>
          <p className={styles.heroLead}>{marketingCopy.hero.lead}</p>
          <div className={styles.actions}>
            <a className={styles.primaryButton} href="#website-review">
              {CTA_LABELS.primary}
              <Arrow />
            </a>
            <a className={styles.textButton} href="#website-review">
              {CTA_LABELS.review} <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className={styles.ownerNote}>{marketingCopy.hero.ownerNote}</p>
          <div className={styles.heroPromise}>
            {heroPromises.map((promise) => (
              <span key={promise}>{promise}</span>
            ))}
          </div>
        </div>
        <Reveal className={styles.heroVisual}>
          <ProductMockup showCallouts />
        </Reveal>
      </section>

      <section className={styles.problemSection} id="story">
        <Reveal className={styles.problemIntro}>
          <SectionIntro {...marketingCopy.problem} />
        </Reveal>
        <div className={styles.storyGrid}>
          <Reveal className={styles.messPanel}>
            <p className={styles.panelLabel}>What a guest wants to know</p>
            {guestQuestions.map((question, index) => (
              <div className={styles.problemLine} key={question}>
                <span>0{index + 1}</span>
                {question}
              </div>
            ))}
          </Reveal>
          <div className={styles.storyArrow} aria-hidden="true">
            →
          </div>
          <Reveal className={styles.clarityPanel}>
            <div className={styles.clarityHeader}>
              <span className={styles.liveDot} />
              OPEN UNTIL 9 PM
            </div>
            <h3>Everything they need, in one clear place.</h3>
            <div className={styles.clarityLinks}>
              <span>
                Explore the menu <b>→</b>
              </span>
              <span>
                Order pickup <b>→</b>
              </span>
              <span>
                Get directions <b>→</b>
              </span>
            </div>
          </Reveal>
        </div>
        <p className={styles.problemClose}>
          Your restaurant may be excellent. Its online presence should make that easy to believe.
        </p>
      </section>

      <section className={styles.journeySection}>
        <SectionIntro {...marketingCopy.journey} />
        <Reveal className={styles.journeyVisual}>
          <div className={styles.journeyLine} aria-hidden="true" />
          <ol className={styles.journeySteps}>
            {journeySteps.map((step, index) => (
              <li key={step.title} style={{ "--step-delay": `${index * 140}ms` } as React.CSSProperties}>
                <span className={styles.journeyNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.journeyDot} aria-hidden="true" />
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>
        </Reveal>
        <div className={styles.outcomeGrid}>
          {outcomes.map((item, index) => (
            <Reveal className={styles.outcomeItem} key={item.title}>
              <span>0{index + 1}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.processSection} id="how-it-works">
        <SectionIntro eyebrow={marketingCopy.process.eyebrow} title={marketingCopy.process.title} />
        <ol className={styles.processGrid}>
          {processSteps.map((step, index) => (
            <li key={step.title}>
              <span className={styles.stepNumber}>0{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.careSection}>
        <div className={styles.careCopy}>
          <p className={styles.eyebrow}>Managed website care</p>
          <h2>A website isn’t finished when it launches.</h2>
          <p>
            Menus change. Hours shift. New photos arrive. Send the update our way and we’ll keep your
            essential information current—without another system for you to learn.
          </p>
          <a className={styles.lightLink} href="#services">
            See what care includes <span aria-hidden="true">↓</span>
          </a>
        </div>
        <Reveal className={styles.updateBoard}>
          <div className={styles.updateTop}>
            <span>Routine care</span>
            <small>HANDLED BY MENU MAN</small>
          </div>
          {routineUpdates.map((item, index) => (
            <div className={styles.updateRow} key={item}>
              <span className={styles.check}>✓</span>
              <strong>{item}</strong>
              <small>{index === 0 ? "Included" : "Routine"}</small>
            </div>
          ))}
          <p>Major redesigns, new features, and larger integrations are quoted as separate projects.</p>
        </Reveal>
      </section>

      <section className={styles.servicesSection} id="services">
        <SectionIntro {...marketingCopy.services} />
        <div className={styles.servicesList}>
          {services.map((service, index) => (
            <article className={styles.serviceRow} key={service.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{service.title}</h3>
              <p>{service.copy}</p>
              <small>{service.type}</small>
            </article>
          ))}
        </div>
        <div className={styles.pricingNote} id="pricing">
          <strong>Clear scope, no fake software tiers.</strong>
          <span>Pricing is tailored to the restaurant and explained before work begins.</span>
        </div>
      </section>

      <section className={styles.workSection} id="work">
        <div className={styles.workCopy}>
          <p className={styles.eyebrow}>{marketingCopy.work.eyebrow}</p>
          <h2>{marketingCopy.work.title}</h2>
          <p>{marketingCopy.work.copy}</p>
          <div className={styles.tags}>
            {armandoProof.map((proof) => (
              <span key={proof}>{proof}</span>
            ))}
          </div>
          <div className={styles.workActions}>
            <Link className={styles.primaryButton} href="/r/armandos">
              View the live demo <Arrow />
            </Link>
            <a className={styles.textButton} href="#website-review">
              {CTA_LABELS.showcase}
            </a>
          </div>
        </div>
        <Reveal className={styles.workVisual}>
          <ProductMockup />
        </Reveal>
      </section>

      <section className={styles.analyticsSection}>
        <div className={styles.analyticsCopy}>
          <p className={styles.eyebrow}>Insights preview</p>
          <h2>Answers, not another analytics dashboard.</h2>
          <p>
            Ask basic questions with Website Care. Add Insights for monthly reporting, deeper trends,
            plain-English interpretation, and recommended next steps.
          </p>
          <span className={styles.previewPill}>ILLUSTRATIVE EXAMPLE · NOT CLIENT RESULTS</span>
        </div>
        <Reveal className={styles.analyticsBoard}>
          <div className={styles.analyticsTop}>
            <div>
              <small>Example website visits</small>
              <strong>2,184</strong>
            </div>
            <span>Sample month</span>
          </div>
          <div className={styles.chart} aria-label="Illustrative example traffic chart">
            <i style={{ height: "35%" }} />
            <i style={{ height: "52%" }} />
            <i style={{ height: "46%" }} />
            <i style={{ height: "68%" }} />
            <i style={{ height: "61%" }} />
            <i style={{ height: "84%" }} />
            <i style={{ height: "76%" }} />
          </div>
          <div className={styles.metricRow}>
            <div>
              <small>Menu views</small>
              <strong>1,406</strong>
            </div>
            <div>
              <small>Order clicks</small>
              <strong>318</strong>
            </div>
            <div>
              <small>Top section</small>
              <strong>Lunch</strong>
            </div>
          </div>
          <div className={styles.insightNote}>
            <span>MM</span>
            <p>
              <strong>Example plain-English note</strong>
              Your menu gets the most attention around lunchtime. Keep lunch hours and ordering links easy
              to spot.
            </p>
          </div>
        </Reveal>
      </section>

      <section className={styles.formsSection} id="website-review">
        <div className={styles.reviewPitch}>
          <p className={styles.eyebrow}>{marketingCopy.review.eyebrow}</p>
          <h2>{marketingCopy.review.title}</h2>
          <p>{marketingCopy.review.copy}</p>
          <ul>
            {reviewCriteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
          <p className={styles.humanNote}>
            Prefer a conversation? <a href="mailto:hello@getmenuman.com?subject=Menu%20Man%20website%20question">Talk to a human.</a>
          </p>
        </div>
        <DemoForm kind="review" />
      </section>

      <section className={styles.nominationSection}>
        <div>
          <p className={styles.eyebrow}>Support a local favorite</p>
          <h2>Know a great restaurant that deserves a better website?</h2>
          <p>Send us their name. We’ll take a thoughtful look—no awkward sales pitch on your behalf.</p>
        </div>
        <DemoForm kind="nomination" />
      </section>

      <section className={styles.faqSection} id="faq">
        <SectionIntro eyebrow="Common questions" title="The practical details." />
        <div className={styles.faqList}>
          {faqs.map((faq, index) => (
            <details key={faq.question}>
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {faq.question}
                <b aria-hidden="true">+</b>
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <p className={styles.eyebrow}>Your restaurant, properly represented</p>
        <h2>Let’s make your website feel as welcoming as your front door.</h2>
        <div className={styles.actions}>
          <a className={styles.creamButton} href="#website-review">
            {CTA_LABELS.primary}
            <Arrow />
          </a>
          <a className={styles.darkTextButton} href="#website-review">
            {CTA_LABELS.review} <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <a href="#top" aria-label="Menu Man home">
            <span className={styles.logoMark}>M</span>
            <strong>MENU MAN</strong>
          </a>
          <p>Restaurant websites, built and kept current.</p>
        </div>
        <div>
          <strong>Explore</strong>
          <a href="#how-it-works">How it works</a>
          <a href="#services">Services</a>
          <a href="#work">Work</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div>
          <strong>Contact</strong>
          <a href="#website-review">Free website review</a>
          <a href="mailto:hello@getmenuman.com">hello@getmenuman.com</a>
        </div>
        <div>
          <strong>Legal</strong>
          <span>Privacy — coming soon</span>
          <span>Terms — coming soon</span>
        </div>
        <p className={styles.copyright}>© {new Date().getFullYear()} GetMenuMan.com</p>
      </footer>
    </main>
  );
}
