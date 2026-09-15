import type { Metadata } from "next";
import Link from "next/link";
import {
  CTA_LABEL,
  faqs,
  outcomes,
  problems,
  processSteps,
  services,
} from "./marketing-content";
import { DemoForm, MarketingHeader, Reveal } from "./MarketingInteractions";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Menu Man | Restaurant Websites Built & Managed for You",
  description:
    "Menu Man builds and manages modern websites for restaurants, including menus, routine updates, online ordering options, and reporting.",
};

const Arrow = () => <span aria-hidden="true">↗</span>;

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return <div className={styles.sectionIntro}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2>{copy ? <p className={styles.sectionCopy}>{copy}</p> : null}</div>;
}

function ProductMockup() {
  return (
    <div className={styles.mockupStage} aria-label="Preview of Armando's restaurant website on desktop and mobile">
      <div className={styles.browserMockup}>
        <div className={styles.browserBar}><span /><span /><span /><div>getmenuman.com/r/armandos</div></div>
        <div className={styles.restaurantSite}>
          <nav><strong>ARMANDO&apos;S</strong><span>Menu &nbsp; Our story &nbsp; Visit</span></nav>
          <div className={styles.restaurantHero}><p>FAMILY RECIPES · FRESH EVERY DAY</p><h3>Good food.<br />Made together.</h3><span className={styles.mockButton}>Explore the menu</span></div>
          <div className={styles.dishRow}><div><span>01</span><strong>House favorites</strong></div><div><span>02</span><strong>Freshly made</strong></div><div><span>03</span><strong>Order pickup</strong></div></div>
        </div>
      </div>
      <div className={styles.phoneMockup}><div className={styles.phoneSpeaker} /><div className={styles.phoneScreen}><div className={styles.phoneNav}><strong>A</strong><span>☰</span></div><div className={styles.phoneHero}><small>WELCOME TO</small><strong>Armando&apos;s</strong><span>View menu</span></div><div className={styles.phoneMenu}><small>POPULAR</small><b>House Special</b><p>Made fresh to order</p></div></div></div>
      <div className={styles.careBadge}><span>✓</span><div><strong>Menu updated</strong><small>Handled by Menu Man</small></div></div>
    </div>
  );
}

export default function Home() {
  return (
    <main className={styles.page}>
      <MarketingHeader ctaLabel={CTA_LABEL} />
      <section className={styles.hero}>
        <div className={styles.heroCopy}><p className={styles.eyebrow}>Websites for independent restaurants</p><h1>Your restaurant should look as good online as it does in real life.</h1><p className={styles.heroLead}>We build and manage your restaurant website, so you can focus on the dining room—not another dashboard.</p><div className={styles.actions}><a className={styles.primaryButton} href="#website-review">{CTA_LABEL}<Arrow /></a><a className={styles.textButton} href="#website-review">Get a Free Website Review <span aria-hidden="true">↓</span></a></div><div className={styles.heroPromise}><span>Built around your restaurant</span><span>Kept current for you</span><span>Easy for guests to use</span></div></div>
        <Reveal className={styles.heroVisual}><ProductMockup /></Reveal>
      </section>

      <section className={styles.problemSection} id="how-it-works">
        <Reveal className={styles.problemIntro}><SectionIntro eyebrow="The problem" title="Great restaurants shouldn’t be hard to choose online." copy="Guests make quick decisions. A scattered, outdated online presence makes a confident choice harder than it should be." /></Reveal>
        <div className={styles.storyGrid}><Reveal className={styles.messPanel}><p className={styles.panelLabel}>What guests often find</p>{problems.map((problem, index) => <div className={styles.problemLine} key={problem}><span>0{index + 1}</span>{problem}</div>)}</Reveal><div className={styles.storyArrow} aria-hidden="true">→</div><Reveal className={styles.clarityPanel}><div className={styles.clarityHeader}><span className={styles.liveDot} />OPEN UNTIL 9 PM</div><h3>Everything a guest needs, in one clear place.</h3><div className={styles.clarityLinks}><span>Explore the menu <b>→</b></span><span>Order pickup <b>→</b></span><span>Get directions <b>→</b></span></div></Reveal></div>
      </section>

      <section className={styles.outcomeSection}>
        <SectionIntro eyebrow="A better first impression" title="Make the next step obvious." copy="Your site should answer the questions standing between a hungry customer and their next order." />
        <div className={styles.outcomeLayout}><div className={styles.outcomeFeature}><span className={styles.bigNumber}>01</span><h3>Help people decide with confidence.</h3><p>A clear menu, current details, and a polished mobile experience show guests exactly what to expect.</p></div><div className={styles.outcomeList}>{outcomes.map((item, index) => <Reveal className={styles.outcomeItem} key={item.title}><span>0{index + 2}</span><div><h3>{item.title}</h3><p>{item.copy}</p></div></Reveal>)}</div></div>
      </section>

      <section className={styles.processSection}>
        <SectionIntro eyebrow="How it works" title="You run the restaurant. We’ll handle the website." />
        <ol className={styles.processGrid}>{processSteps.map((step, index) => <li key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.copy}</p></div></li>)}</ol>
      </section>

      <section className={styles.careSection}>
        <div className={styles.careCopy}><p className={styles.eyebrow}>Managed website care</p><h2>A website isn’t finished when it launches.</h2><p>Menus change. Hours shift. New photos arrive. Send the update our way and we’ll keep your essential information current.</p><a className={styles.lightLink} href="#services">See what care includes <span aria-hidden="true">↓</span></a></div>
        <Reveal className={styles.updateBoard}><div className={styles.updateTop}><span>Recent updates</span><small>MENU MAN CARE</small></div>{["Weekend hours updated", "Spring menu price change", "New pickup link added", "Dining room photo replaced"].map((item, index) => <div className={styles.updateRow} key={item}><span className={styles.check}>✓</span><strong>{item}</strong><small>{index === 0 ? "Today" : `${index + 1} days ago`}</small></div>)}<p>Routine changes, handled without another system to learn.</p></Reveal>
      </section>

      <section className={styles.servicesSection} id="services">
        <SectionIntro eyebrow="A flexible service" title="Build it well. Keep it cared for. Add more when it makes sense." />
        <div className={styles.servicesList}>{services.map((service, index) => <article className={styles.serviceRow} key={service.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{service.title}</h3><p>{service.copy}</p><small>{service.type}</small></article>)}</div>
        <p className={styles.pricingNote} id="pricing">Pricing is tailored to the restaurant and scope. Clear options are provided before work begins.</p>
      </section>

      <section className={styles.workSection} id="work">
        <div className={styles.workCopy}><p className={styles.eyebrow}>Featured work</p><h2>Armando&apos;s</h2><p>A restaurant experience that puts the menu, pickup flow, and practical visit details within easy reach.</p><div className={styles.tags}><span>Responsive menu</span><span>Online ordering</span><span>Restaurant information</span></div><div className={styles.workActions}><Link className={styles.primaryButton} href="/r/armandos">View the live demo <Arrow /></Link><a className={styles.textButton} href="#website-review">I Want a Site Like This</a></div></div>
        <Reveal className={styles.workVisual}><ProductMockup /></Reveal>
      </section>

      <section className={styles.analyticsSection}>
        <div className={styles.analyticsCopy}><p className={styles.eyebrow}>Insights preview</p><h2>Know what guests are looking for.</h2><p>Optional reporting can turn website activity into a short, plain-English view of what people use most.</p><span className={styles.previewPill}>EXAMPLE INTERFACE · NOT LIVE DATA</span></div>
        <Reveal className={styles.analyticsBoard}><div className={styles.analyticsTop}><div><small>Website visits</small><strong>2,184</strong></div><span>Last 30 days</span></div><div className={styles.chart} aria-label="Example traffic chart"><i style={{height:"35%"}}/><i style={{height:"52%"}}/><i style={{height:"46%"}}/><i style={{height:"68%"}}/><i style={{height:"61%"}}/><i style={{height:"84%"}}/><i style={{height:"76%"}}/></div><div className={styles.metricRow}><div><small>Menu views</small><strong>1,406</strong></div><div><small>Order clicks</small><strong>318</strong></div><div><small>Top section</small><strong>Lunch</strong></div></div><div className={styles.insightNote}><span>MM</span><p><strong>Monthly note</strong>Your menu gets the most attention between 11 a.m. and 1 p.m.</p></div></Reveal>
      </section>

      <section className={styles.formsSection} id="website-review"><div className={styles.reviewPitch}><p className={styles.eyebrow}>A useful first step</p><h2>Get a free website review.</h2><p>Share your current site and we’ll identify the clearest opportunities to make it more useful for guests.</p><ul><li>Mobile experience</li><li>Menu and ordering clarity</li><li>Hours, location, and contact details</li><li>Visual first impression</li></ul></div><DemoForm kind="review" /></section>

      <section className={styles.nominationSection}><div><p className={styles.eyebrow}>Support a local favorite</p><h2>Know a great restaurant that deserves a better website?</h2><p>Send us their name. We’ll take a thoughtful look—no awkward sales pitch on your behalf.</p></div><DemoForm kind="nomination" /></section>

      <section className={styles.faqSection} id="faq"><SectionIntro eyebrow="Common questions" title="The practical details." /><div className={styles.faqList}>{faqs.map((faq, index) => <details key={faq.question}><summary><span>{String(index + 1).padStart(2, "0")}</span>{faq.question}<b aria-hidden="true">+</b></summary><p>{faq.answer}</p></details>)}</div></section>

      <section className={styles.finalCta}><p className={styles.eyebrow}>Your restaurant, properly represented</p><h2>Let’s make your website feel as welcoming as your front door.</h2><div className={styles.actions}><a className={styles.creamButton} href="#website-review">{CTA_LABEL}<Arrow /></a><a className={styles.darkTextButton} href="#website-review">Get a Free Website Review <span aria-hidden="true">→</span></a></div></section>

      <footer className={styles.footer}><div className={styles.footerBrand}><a href="#top" aria-label="Menu Man home"><span className={styles.logoMark}>M</span><strong>MENU MAN</strong></a><p>Restaurant websites, built and kept current.</p></div><div><strong>Explore</strong><a href="#work">Work</a><a href="#how-it-works">How it works</a><a href="#services">Services</a><a href="#faq">FAQ</a></div><div><strong>Contact</strong><a href="#website-review">Free website review</a><a href="mailto:hello@getmenuman.com">hello@getmenuman.com</a></div><div><strong>Legal</strong><span>Privacy — coming soon</span><span>Terms — coming soon</span></div><p className={styles.copyright}>© {new Date().getFullYear()} GetMenuMan.com</p></footer>
    </main>
  );
}
