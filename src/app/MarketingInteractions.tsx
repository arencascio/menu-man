"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CTA_LABELS } from "./marketing-content";
import styles from "./page.module.css";

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className={styles.header} id="top">
      <a className={styles.brand} href="#top" aria-label="Menu Man home">
        <span className={styles.logoMark}>M</span>
        <strong>MENU MAN</strong>
      </a>
      <button
        className={styles.menuButton}
        type="button"
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={() => setOpen(!open)}
      >
        <span>{open ? "Close" : "Menu"}</span>
        <i aria-hidden="true" />
      </button>
      <nav
        className={`${styles.nav} ${open ? styles.navOpen : ""}`}
        id="main-navigation"
        aria-label="Main navigation"
      >
        <a href="#how-it-works" onClick={close}>How It Works</a>
        <a href="#services" onClick={close}>Services</a>
        <a href="#work" onClick={close}>Work</a>
        <a href="#pricing" onClick={close}>Pricing</a>
        <a className={styles.navCta} href="#website-review" onClick={close}>
          {CTA_LABELS.review}<span aria-hidden="true">↘</span>
        </a>
      </nav>
    </header>
  );
}

export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.dataset.visible = "true";
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`${styles.reveal} ${className}`}>{children}</div>;
}

export function DemoForm({ kind }: { kind: "review" | "nomination" }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const isReview = kind === "review";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    window.setTimeout(() => setStatus("success"), 650);
  }

  if (status === "success") {
    return (
      <div className={styles.formSuccess} role="status">
        <span>✓</span>
        <h3>{isReview ? "Your review request is ready." : "Your nomination is ready."}</h3>
        <p>This preview does not send submissions yet. The form is ready to connect to a delivery endpoint.</p>
        <button type="button" onClick={() => setStatus("idle")}>Back to the form</button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.fieldRow}>
        <label>
          Restaurant name
          <input name="restaurantName" required autoComplete="organization" placeholder="e.g. Armando's" />
        </label>
        {isReview ? (
          <label>
            Contact name
            <input name="contactName" required autoComplete="name" placeholder="Your name" />
          </label>
        ) : (
          <label>
            City
            <input name="city" required autoComplete="address-level2" placeholder="City, state" />
          </label>
        )}
      </div>
      <label>
        {isReview ? "Current website URL" : "Website or social URL"}
        <input name="website" type="url" required placeholder="https://" inputMode="url" />
      </label>
      <label>
        {isReview ? "Email" : "Your email (optional)"}
        <input name="email" type="email" required={isReview} autoComplete="email" placeholder="you@restaurant.com" />
      </label>
      <label>
        {isReview ? "Anything we should know? (optional)" : "Why do you recommend this restaurant?"}
        <textarea
          name="notes"
          required={!isReview}
          rows={3}
          placeholder={isReview ? "Menu changes, ordering setup, upcoming opening…" : "Tell us what makes it special."}
        />
      </label>
      <button className={styles.formSubmit} type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Preparing…" : isReview ? "Request My Free Review" : "Nominate This Restaurant"}
        <span aria-hidden="true">→</span>
      </button>
      <p className={styles.formNote}>Demo form only—submissions are not sent yet.</p>
    </form>
  );
}
