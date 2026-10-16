"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import smartphoneIcon from "../../img/icons/smartphone.svg";
import searchIcon from "../../img/icons/search.svg";
import linkIcon from "../../img/icons/link-2.svg";
import locationIcon from "../../img/icons/map-pinned.svg";
import { productFeatures, CTA_LABELS } from "./marketing-content";
import styles from "./page.module.css";
import { LeadFormFeedback, useMarketingLead } from "./MarketingLeadForm";

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
  const lead = useMarketingLead("review");
  const { resetSuccess } = lead;
  const [noWebsite, setNoWebsite] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    function show() {
      openerRef.current = document.activeElement as HTMLElement | null;
      resetSuccess();
      setOpen(true);
    }
    window.addEventListener(REVIEW_EVENT, show);
    return () => window.removeEventListener(REVIEW_EVENT, show);
  }, [resetSuccess]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const getFocusable = () => dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled):not([tabindex="-1"]), a[href], textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );
    getFocusable()?.[0]?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      const focusable = getFocusable();
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
        {lead.state.accepted ? (
          <div className={styles.formSuccess} role="status">
            <span aria-hidden="true">✓</span>
            <h2 id={titleId}>Your review request has been sent.</h2>
            <p>Our email provider accepted your request. We will follow up at the email address you provided.</p>
            <a href={lead.emailHref}>Email hello@getmenuman.com</a>
            <button type="button" onClick={lead.resetSuccess}>Back to the form</button>
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>Free restaurant website review</p>
            <h2 id={titleId}>See how your restaurant looks online.</h2>
            <p className={styles.modalLead}>Share the basics. We will look for the clearest ways to make your restaurant easier to choose.</p>
            <form className={styles.form} onSubmit={lead.submit} onChange={(event) => lead.capture(event.currentTarget)} aria-busy={lead.state.pending}>
              <fieldset className={styles.leadFields} disabled={lead.state.pending}>
              <label>
                Restaurant name
                <input name="restaurantName" maxLength={160} required autoComplete="organization" />
              </label>
              <label>
                Website URL
                <input name="website" maxLength={500} type="text" inputMode="url" disabled={noWebsite} required={!noWebsite} placeholder="restaurant.com" />
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
                <input name="email" maxLength={254} type="email" required autoComplete="email" />
              </label>
              <button className={styles.formSubmit} type="submit">
                {lead.state.pending ? "Sending..." : CTA_LABELS.review} <span aria-hidden="true">&rarr;</span>
              </button>
              </fieldset>
              <LeadFormFeedback error={lead.state.error} emailHref={lead.emailHref} />
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const productIcons = { mobile: smartphoneIcon, search: searchIcon, order: linkIcon, details: locationIcon };

export function ProductGallery() {
  const [active, setActive] = useState<(typeof productFeatures)[number]["id"]>("mobile");
  const activeFeature = productFeatures.find((feature) => feature.id === active) ?? productFeatures[0];
  const galleryId = useId();

  return (
    <div className={styles.gallery}>
      <div className={styles.galleryTabs} role="tablist" aria-label="Restaurant website features">
        {productFeatures.map((feature) => (
          <button
            key={feature.id}
            type="button"
            role="tab"
            id={`${galleryId}-${feature.id}`}
            aria-controls={`${galleryId}-panel`}
            aria-selected={active === feature.id}
            onClick={() => setActive(feature.id)}
          >
            <strong>{feature.title}</strong>
          </button>
        ))}
      </div>
      <div className={styles.galleryDisplay} role="tabpanel" id={`${galleryId}-panel`} aria-labelledby={`${galleryId}-${active}`}>
        <Image className={styles.productIcon} src={productIcons[active]} alt="" width={128} height={128} />
        <div className={styles.galleryCaption}>
          <h3>{activeFeature.title}</h3>
          <p>{activeFeature.copy}</p>
        </div>
      </div>
    </div>
  );
}

export function BuildWebsiteForm() {
  const lead = useMarketingLead("website");

  if (lead.state.accepted) {
    return (
      <div className={`${styles.formSuccess} ${styles.leadFormSuccess}`} role="status">
        <span aria-hidden="true">✓</span>
        <h2>Your inquiry has been sent.</h2>
        <p>Our email provider accepted your inquiry. We will follow up at the email address you provided.</p>
        <a href={lead.emailHref}>Email hello@getmenuman.com</a>
        <button type="button" onClick={lead.resetSuccess}>Back to the form</button>
      </div>
    );
  }

  return (
    <form className={`${styles.form} ${styles.leadForm}`} onSubmit={lead.submit} onChange={(event) => lead.capture(event.currentTarget)} aria-busy={lead.state.pending}>
      <fieldset className={styles.leadFields} disabled={lead.state.pending}>
      <div className={styles.fieldGrid}>
        <label>Restaurant name<input name="restaurantName" maxLength={160} required autoComplete="organization" /></label>
        <label>Your name<input name="name" maxLength={160} required autoComplete="name" /></label>
        <label>Email<input name="email" maxLength={254} type="email" required autoComplete="email" /></label>
        <label>Phone (optional)<input name="phone" maxLength={50} type="tel" autoComplete="tel" /></label>
        <label>City<input name="city" maxLength={160} required autoComplete="address-level2" /></label>
        <label>Current website<input name="website" maxLength={500} type="text" inputMode="url" placeholder="restaurant.com (optional)" /></label>
      </div>
      <fieldset>
        <legend>Do you currently offer online ordering?</legend>
        <div className={styles.choiceRow}>
          <label><input type="radio" name="onlineOrdering" value="yes" required /> Yes</label>
          <label><input type="radio" name="onlineOrdering" value="no" /> No</label>
          <label><input type="radio" name="onlineOrdering" value="unsure" /> Not sure</label>
        </div>
      </fieldset>
      <label>Current ordering provider(s)<input name="orderingProviders" maxLength={300} placeholder="Clover, Square, Toast, DoorDash..." /></label>
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
      <label>Anything else we should know?<textarea name="notes" maxLength={2000} rows={4} /></label>
      <button className={styles.formSubmit} type="submit">{lead.state.pending ? "Sending..." : CTA_LABELS.primary} <span aria-hidden="true">&rarr;</span></button>
      </fieldset>
      <LeadFormFeedback error={lead.state.error} emailHref={lead.emailHref} />
    </form>
  );
}
