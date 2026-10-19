"use client";

import { useRef, useState } from "react";
import { inquirySchema, eventDateAllowed } from "@/lib/catering/contracts";
import { trackEvent } from "@/lib/analytics/client";
import styles from "./catering.module.css";

export default function CateringInquiryForm({ slug, restaurantId, timezone, ctaLabel }: { slug: string; restaurantId: string; timezone: string; ctaLabel: string }) {
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const submissionId = useRef<string | null>(null);
  const started = useRef(false);
  const failure = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  function showError(message: string, issues: Record<string, string> = {}) {
    setError(message); setFields(issues);
    requestAnimationFrame(() => failure.current?.focus());
  }
  if (accepted) return <section className={styles.confirmation} role="status" tabIndex={-1} ref={(element) => element?.focus()}>
    <h2>Request received</h2><p>Your request was saved for the restaurant to review. Any follow-up will use the contact details you provided.</p>
    <p>This is an inquiry, not a confirmed booking or quote. No payment has been taken.</p>
  </section>;
  return <form id="catering-inquiry" className={styles.form} noValidate aria-busy={pending} onChange={() => {
    if (!started.current) { started.current = true; trackEvent({ name: "catering_form_started", restaurantId, pageType: "catering" }); }
  }} onSubmit={async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    submissionId.current ??= crypto.randomUUID();
    const parsed = inquirySchema.safeParse({
      submissionId: submissionId.current, name: form.get("name"), email: form.get("email"), phone: form.get("phone"),
      eventDate: form.get("eventDate"), guestCount: Number(form.get("guestCount")),
      eventDetails: form.get("eventDetails"), notes: form.get("notes"), companyFax: form.get("companyFax"),
    });
    if (!parsed.success) { showError("Please check your request details.", Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message]))); return; }
    if (!eventDateAllowed(parsed.data.eventDate, timezone)) { showError("Choose today or a future event date.", { eventDate: "Choose today or a future date in the restaurant's timezone." }); return; }
    submitting.current = true; setPending(true); setError(""); setFields({});
    try {
      const response = await fetch(`/api/restaurants/${encodeURIComponent(slug)}/catering`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(25000) });
      const body = await response.json();
      if (!response.ok || body.accepted !== true) { showError(body.error || "We could not confirm your request. Retry with the same details.", body.fields); return; }
      setAccepted(true);
      // A successful retry may be the customer's first confirmed response. This
      // mounted form confirms once, even when the server resolves an exact replay.
      trackEvent({ name: "catering_inquiry_accepted", restaurantId, pageType: "catering" });
    } catch { showError("We could not confirm your request. Check your connection and retry with the same details."); }
    finally { submitting.current = false; setPending(false); }
  }}>
    <h2>Your event</h2>
    <p id="catering-request-note">Send a request for the restaurant to review. This does not confirm a booking, availability, or pricing.</p>
    {error ? <div ref={failure} className={styles.error} role="alert" tabIndex={-1}>{error}</div> : null}
    <fieldset disabled={pending} className={styles.fields} aria-describedby="catering-request-note">
      <legend className={styles.srOnly}>Catering request details</legend>
      {([
        ["name", "Your name", "text", 120, "name"],
        ["email", "Email address", "email", 320, "email"],
        ["phone", "Phone number", "tel", 40, "tel"],
        ["eventDate", "Event date", "date", undefined, "off"],
        ["guestCount", "Approximate guest count", "number", undefined, "off"],
      ] as const).map(([name, label, type, maxLength, autoComplete]) => <div className={styles.field} key={name}>
        <label htmlFor={`catering-${name}`}>{label}{["name", "eventDate", "guestCount"].includes(name) ? " (required)" : ""}</label>
        <input id={`catering-${name}`} name={name} type={type} autoComplete={autoComplete} maxLength={maxLength}
          required={["name", "eventDate", "guestCount"].includes(name)} min={type === "number" ? 1 : undefined} max={type === "number" ? 100000 : undefined} step={type === "number" ? 1 : undefined}
          aria-invalid={Boolean(fields[name])} aria-describedby={`${name === "email" || name === "phone" ? "catering-contact-note " : ""}${fields[name] ? `catering-${name}-error` : ""}`.trim() || undefined} />
        {fields[name] ? <span id={`catering-${name}-error`} className={styles.errorText}>{fields[name]}</span> : null}
      </div>)}
      <p className={styles.full} id="catering-contact-note">Provide at least one valid contact method: email or phone.</p>
      {([ ["eventDetails", "Event details (optional)", 1000], ["notes", "Additional notes (optional)", 2000] ] as const).map(([name, label, limit]) => <div key={name} className={`${styles.field} ${styles.full}`}>
        <label htmlFor={`catering-${name}`}>{label}</label><textarea name={name} id={`catering-${name}`} rows={3} maxLength={limit} aria-invalid={Boolean(fields[name])} aria-describedby={fields[name] ? `catering-${name}-error` : undefined} />
        {fields[name] ? <span id={`catering-${name}-error`} className={styles.errorText}>{fields[name]}</span> : null}
      </div>)}
      <div className={styles.trap} aria-hidden="true"><label>Leave empty<input name="companyFax" tabIndex={-1} autoComplete="off" /></label></div>
      <p className={styles.full}>Your contact and event details are shared with this restaurant to respond to your request. Do not include payment details or sensitive personal information.</p>
      <button className={styles.button} type="submit">{pending ? "Sending request…" : ctaLabel}</button>
    </fieldset>
    {pending ? <p role="status">Sending your request. Please keep this page open.</p> : null}
  </form>;
}
