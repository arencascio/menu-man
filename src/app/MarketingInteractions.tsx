"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import menuIcon from "../../img/icons/menu.svg";
import { CTA_LABELS, PUBLIC_PRICING } from "./marketing-content";
import MarketingFeaturettes from "./MarketingFeaturettes";
import styles from "./page.module.css";
import { LeadFormFeedback, useMarketingLead } from "./MarketingLeadForm";
import { marketingCta } from "@/lib/analytics/marketing";
import type { MarketingPlacement } from "@/lib/analytics/types";

const REVIEW_EVENT = "menu-man:open-review";

export function MarketingHeader({ brand }: { brand: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const rendered = open || closing;
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const close = useCallback(() => {
    setClosing(window.matchMedia("(max-width: 820px)").matches);
    setOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const header = headerRef.current;
    const page = header?.closest<HTMLElement>("[data-marketing-page]");
    if (!header || !page) return;
    const measure = () => page.style.setProperty("--marketing-header-height", `${header.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        close();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, close]);

  useEffect(() => {
    if (!rendered) return;
    // Separate from the review dialog's body lock so the two can hand off safely.
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previousOverflow; };
  }, [rendered]);

  useEffect(() => {
    if (!open) return;
    navigationRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = [menuButtonRef.current, ...Array.from(navigationRef.current?.querySelectorAll<HTMLElement>("a, button") ?? [])].filter((node): node is HTMLElement => !!node);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
    };
  }, [open]);

  useEffect(() => {
    if (!closing) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600;
    const timer = window.setTimeout(() => setClosing(false), delay);
    return () => window.clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 821px)");
    const reset = () => { if (desktop.matches) { setOpen(false); setClosing(false); } };
    desktop.addEventListener("change", reset);
    return () => desktop.removeEventListener("change", reset);
  }, []);

  return (
    <header ref={headerRef} className={styles.header}>
      {brand}
      <button
        ref={menuButtonRef}
        className={styles.menuButton}
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-controls="marketing-navigation"
        onClick={() => { if (open) close(); else { setClosing(false); setOpen(true); } }}
      >
        {open ? <span>Close</span> : <Image src={menuIcon} alt="" width={24} height={24} />}
      </button>
      {rendered && <button type="button" className={styles.menuBackdrop} data-closing={!open} tabIndex={-1} aria-label="Close navigation backdrop" onClick={close} />}
      <nav
        ref={navigationRef}
        className={`${styles.nav} ${open ? styles.navOpen : closing ? styles.navClosing : ""}`}
        inert={closing || undefined}
        aria-hidden={closing || undefined}
        data-menu-state={open ? "open" : closing ? "closing" : "closed"}
        onTransitionEnd={(event) => { if (!open && event.target === event.currentTarget && event.propertyName === "transform") setClosing(false); }}
        id="marketing-navigation"
        aria-label="Main navigation"
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && !headerRef.current?.contains(next)) close();
        }}
      >
        <Link href="/#how-it-works" onClick={close}>How It Works</Link>
        <Link href="/services" onClick={close} {...marketingCta("services_pricing", "navigation")}>Services &amp; Pricing</Link>
        <Link href="/work" onClick={close} {...marketingCta("explore_product", "navigation")}>Work</Link>
        <ReviewButton placement="navigation" className={styles.navReview} onOpen={close}>Free Website Review</ReviewButton>
        <Link className={styles.navCta} href="/build-my-website" onClick={close} {...marketingCta("build_website", "navigation")}>
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
  placement = "section",
}: {
  children?: React.ReactNode;
  className?: string;
  onOpen?: () => void;
  placement?: MarketingPlacement;
}) {
  return (
    <button
      className={className}
      type="button"
      {...marketingCta("website_review", placement, "modal")}
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
  const { resetSuccess, open: trackOpen, close: trackClose } = lead;
  const openedRef = useRef(false);
  const [noWebsite, setNoWebsite] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const close = useCallback(() => {
    openedRef.current = false;
    trackClose();
    setOpen(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }, [trackClose]);

  useEffect(() => {
    function show() {
      if (openedRef.current) return;
      openedRef.current = true;
      trackOpen();
      openerRef.current = document.activeElement as HTMLElement | null;
      resetSuccess();
      setOpen(true);
    }
    window.addEventListener(REVIEW_EVENT, show);
    return () => window.removeEventListener(REVIEW_EVENT, show);
  }, [resetSuccess, trackOpen]);

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
  }, [open, close]);

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
            <a href={lead.emailHref} data-marketing-email="website_review" data-marketing-placement="form">Email hello@getmenuman.com</a>
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
              <LeadFormFeedback error={lead.state.error} emailHref={lead.emailHref} formType="website_review" />
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export function ProductGallery() {
  return <MarketingFeaturettes />;
}

export function BuildWebsiteForm() {
  const lead = useMarketingLead("website");

  if (lead.state.accepted) {
    return (
      <div className={`${styles.formSuccess} ${styles.leadFormSuccess}`} role="status">
        <span aria-hidden="true">✓</span>
        <h2>Your inquiry has been sent.</h2>
        <p>Our email provider accepted your inquiry. We will follow up at the email address you provided.</p>
        <a href={lead.emailHref} data-marketing-email="website_inquiry" data-marketing-placement="form">Email hello@getmenuman.com</a>
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
      <div className={styles.formPrice}>
        <strong>{PUBLIC_PRICING.monthly}</strong>
        <p>Plus a {PUBLIC_PRICING.startupFee} one-time startup fee</p>
      </div>
      <button className={styles.formSubmit} type="submit">{lead.state.pending ? "Sending..." : CTA_LABELS.primary} <span aria-hidden="true">&rarr;</span></button>
      </fieldset>
      <LeadFormFeedback error={lead.state.error} emailHref={lead.emailHref} formType="website_inquiry" />
    </form>
  );
}
