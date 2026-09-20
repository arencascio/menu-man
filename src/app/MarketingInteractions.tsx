"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import ArmandoDevice from "./ArmandoDevice";
import { armandoFeatures, CTA_LABELS } from "./marketing-content";
import styles from "./page.module.css";

const REVIEW_EVENT = "menu-man:open-review";

export function MarketingHeader({ brand }: { brand: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function close() {
    setOpen(false);
  }

  return (
    <header className={styles.header}>
      {brand}
      <button
        ref={menuButtonRef}
        className={styles.menuButton}
        type="button"
        aria-expanded={open}
        aria-controls="marketing-navigation"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{open ? "Close" : "Menu"}</span>
        <i aria-hidden="true" />
      </button>
      <nav
        className={`${styles.nav} ${open ? styles.navOpen : ""}`}
        id="marketing-navigation"
        aria-label="Main navigation"
      >
        <Link href="/#how-it-works" onClick={close}>How It Works</Link>
        <Link href="/services" onClick={close}>Services &amp; Pricing</Link>
        <Link href="/work" onClick={close}>Work</Link>
        <ReviewButton className={styles.navReview} onOpen={close}>Free Website Review</ReviewButton>
        <Link className={styles.navCta} href="/build-my-website" onClick={close}>
          Build My Website <span aria-hidden="true">&rarr;</span>
        </Link>
      </nav>
    </header>
  );
}

export function ReviewButton({
  children = CTA_LABELS.review,
  className = "",
  onOpen,
}: {
  children?: React.ReactNode;
  className?: string;
  onOpen?: () => void;
}) {
  return (
    <button
      className={className}
      type="button"
      onClick={() => {
        onOpen?.();
        window.dispatchEvent(new CustomEvent(REVIEW_EVENT));
      }}
    >
      {children}
    </button>
  );
}

export function ReviewModal() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [noWebsite, setNoWebsite] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    function show() {
      openerRef.current = document.activeElement as HTMLElement | null;
      setSubmitted(false);
      setOpen(true);
    }
    window.addEventListener(REVIEW_EVENT, show);
    return () => window.removeEventListener(REVIEW_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button, input, a[href], textarea, select, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function close() {
    setOpen(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (!open) return null;

  return (
    <div className={styles.modalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button className={styles.modalClose} type="button" aria-label="Close website review form" onClick={close}>
          &times;
        </button>
        {submitted ? (
          <div className={styles.formSuccess} role="status">
            <span aria-hidden="true">✓</span>
            <p className={styles.eyebrow}>Form preview</p>
            <h2 id={titleId}>Your details are ready.</h2>
            <p>This website does not send submissions yet. Email us and we will take it from here.</p>
            <a href="mailto:hello@getmenuman.com?subject=Free%20restaurant%20website%20review">Email hello@getmenuman.com</a>
            <button type="button" onClick={() => setSubmitted(false)}>Back to the form</button>
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>Free restaurant website review</p>
            <h2 id={titleId}>See how your restaurant looks online.</h2>
            <p className={styles.modalLead}>Share the basics. We will look for the clearest ways to make your restaurant easier to choose.</p>
            <form className={styles.form} onSubmit={submit}>
              <label>
                Restaurant name
                <input name="restaurantName" required autoComplete="organization" />
              </label>
              <label>
                Website URL
                <input name="website" type="url" inputMode="url" disabled={noWebsite} required={!noWebsite} placeholder="https://" />
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  name="noWebsite"
                  type="checkbox"
                  checked={noWebsite}
                  onChange={(event) => setNoWebsite(event.target.checked)}
                />
                <span>I don&apos;t have a website</span>
              </label>
              <label>
                Email
                <input name="email" type="email" required autoComplete="email" />
              </label>
              <button className={styles.formSubmit} type="submit">
                {CTA_LABELS.review} <span aria-hidden="true">&rarr;</span>
              </button>
              <p className={styles.formNote}>Demo form only. Nothing is sent yet.</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export function ArmandoGallery() {
  const [active, setActive] = useState<(typeof armandoFeatures)[number]["id"]>("mobile");
  const activeFeature = armandoFeatures.find((feature) => feature.id === active) ?? armandoFeatures[0];
  const mode = active === "mobile" ? "home" : active === "search" ? "menu" : active;

  return (
    <div className={styles.gallery}>
      <div className={styles.galleryTabs} role="tablist" aria-label="Armando's website features">
        {armandoFeatures.map((feature) => (
          <button
            key={feature.id}
            type="button"
            role="tab"
            aria-selected={active === feature.id}
            onClick={() => setActive(feature.id)}
          >
            <span>{feature.kicker}</span>
            <strong>{feature.title}</strong>
          </button>
        ))}
      </div>
      <div className={styles.galleryDisplay} role="tabpanel">
        <div className={styles.galleryVisual}><ArmandoDevice mode={mode} /></div>
        <div className={styles.galleryCaption}>
          <p className={styles.eyebrow}>{activeFeature.kicker}</p>
          <h3>{activeFeature.title}</h3>
          <p>{activeFeature.copy}</p>
        </div>
      </div>
    </div>
  );
}

export function BuildWebsiteForm({ inspiredBy }: { inspiredBy?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const inspiredByArmando = inspiredBy?.toLowerCase() === "armandos";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className={`${styles.formSuccess} ${styles.leadFormSuccess}`} role="status">
        <span aria-hidden="true">✓</span>
        <h2>Your project details are ready.</h2>
        <p>This demo does not send submissions yet. Email us to start the conversation.</p>
        <a href="mailto:hello@getmenuman.com?subject=Build%20my%20restaurant%20website">Email hello@getmenuman.com</a>
        <button type="button" onClick={() => setSubmitted(false)}>Back to the form</button>
      </div>
    );
  }

  return (
    <form className={`${styles.form} ${styles.leadForm}`} onSubmit={submit}>
      {inspiredByArmando ? (
        <div className={styles.referralContext}>
          <span aria-hidden="true">↗</span>
          <div><strong>Inspired by Armando&apos;s</strong><small>We will use that example as a starting point for the conversation.</small></div>
        </div>
      ) : null}
      <input type="hidden" name="inspiredBy" value={inspiredBy ?? ""} />
      <div className={styles.fieldGrid}>
        <label>Restaurant name<input name="restaurantName" required autoComplete="organization" /></label>
        <label>Your name<input name="name" required autoComplete="name" /></label>
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Phone<input name="phone" type="tel" required autoComplete="tel" /></label>
        <label>City<input name="city" required autoComplete="address-level2" /></label>
        <label>Current website<input name="website" type="url" inputMode="url" placeholder="https:// (optional)" /></label>
      </div>
      <fieldset>
        <legend>Do you currently offer online ordering?</legend>
        <div className={styles.choiceRow}>
          <label><input type="radio" name="onlineOrdering" value="yes" required /> Yes</label>
          <label><input type="radio" name="onlineOrdering" value="no" /> No</label>
          <label><input type="radio" name="onlineOrdering" value="unsure" /> Not sure</label>
        </div>
      </fieldset>
      <label>Current ordering provider(s)<input name="orderingProviders" placeholder="Clover, Square, Toast, DoorDash..." /></label>
      <label>
        What do you need help with?
        <select name="help" required defaultValue="">
          <option value="" disabled>Choose one</option>
          <option>Build my first website</option>
          <option>Replace an outdated website</option>
          <option>Make my menu easier to use</option>
          <option>Connect my current ordering system</option>
          <option>Keep my website updated</option>
          <option>Not sure yet</option>
        </select>
      </label>
      <label>Anything else we should know?<textarea name="notes" rows={4} /></label>
      <button className={styles.formSubmit} type="submit">{CTA_LABELS.primary} <span aria-hidden="true">&rarr;</span></button>
      <p className={styles.formNote}>Demo form only. Nothing is sent yet.</p>
    </form>
  );
}

export function NominationForm() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className={styles.nominationThanks} role="status">
        <strong>Thanks for the recommendation.</strong>
        <span>This demo does not send nominations yet.</span>
        <button type="button" onClick={() => setSubmitted(false)}>Back</button>
      </div>
    );
  }

  return (
    <form className={styles.nominationForm} onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
      <label><span className={styles.visuallyHidden}>Restaurant name</span><input required name="restaurant" placeholder="Restaurant name" /></label>
      <label><span className={styles.visuallyHidden}>City</span><input required name="city" placeholder="City" /></label>
      <button type="submit">HELP MY LOCAL RESTAURANT <span aria-hidden="true">&rarr;</span></button>
      <small>Demo only. Nothing is sent yet.</small>
    </form>
  );
}
