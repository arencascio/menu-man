"use client";

import { useRef, useState, type FormEvent } from "react";
import { statuses, statusLabels, type LeadDetail } from "@/lib/ops/contracts";
import { pacificInput, pacificToUtc } from "@/lib/ops/pacific-time";
import styles from "../../ops.module.css";
export default function LeadActions({ lead, emailConfigured }: {
  lead: Pick<LeadDetail, "id" | "status" | "notes" | "followUpAt" | "revision" | "notification">;
  emailConfigured: boolean;
}) {
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes);
  const [followUp, setFollowUp] = useState(() => pacificInput(lead.followUpAt));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  async function act(payload: object, result: string) {
    if (locked.current) return;
    locked.current = true; setPending(true); setError("");
    try {
      const response = await fetch(`/ops/leads/${lead.id}/actions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(25_000),
      });
      const body = await response.json();
      if (!response.ok || body.saved !== true) throw new Error(typeof body.error === "string" ? body.error : "Action was not confirmed. Refresh to check its state.");
      // Full navigation discards stale revision/data and rechecks authorization.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Private inbox deliberately uses document navigation instead of retaining client-router lead data.
      window.location.assign(`/ops/leads/${lead.id}?result=${result}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Action was not confirmed. Refresh to check its state.");
      locked.current = false; setPending(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let followUpAt: string | null;
    try { followUpAt = pacificToUtc(followUp, lead.followUpAt); }
    catch (error) { setError(error instanceof Error ? error.message : "Enter a valid Pacific date and time."); return; }
    await act({ action: "save", revision: lead.revision, status, notes, followUpAt }, "saved");
  }
  const notification = lead.notification;
  let retryReason = "Refresh when the next attempt is due. Server-side limits always apply.";
  if (!emailConfigured) retryReason = "Email sending is unavailable. The inquiry is safely stored.";
  else if (notification.state === "accepted") retryReason = "The provider accepted this email. Inbox delivery is unverified; it will not be resent.";
  else if (notification.state === "unknown" || notification.attemptCount >= 5) retryReason = "Reconciliation is required before any further send. Safety limits cannot be reset here.";
  else if (!notification.hasSender) retryReason = "The original sender was not recorded. Reviewed notification repair is required.";
  else if (notification.retryBlock === "expired") retryReason = "The safe retry window has ended. Reconcile the provider outcome before resending.";
  else if (notification.retryBlock === "leased") retryReason = "Another send holds the notification lease. Refresh after it finishes.";
  return <>
    <section className={styles.panel}><h2>Owner follow-up</h2>
      <form onSubmit={save}><fieldset disabled={pending} className={styles.edit} style={{ border: 0, minWidth: 0 }}>
        <label className={styles.field}>Status<select name="status" value={status} onChange={event => setStatus(event.target.value as typeof status)}>{statuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
        <label className={styles.field}>Follow-up date and time (Pacific)<input type="datetime-local" value={followUp} min="1970-01-01T00:00" max="2100-12-30T23:59" onChange={event => setFollowUp(event.target.value)} aria-describedby="follow-up-help" /></label>
        <p id="follow-up-help" className={styles.muted}>Enter Los Angeles time. Clear the field to remove the follow-up. Daylight saving transition times may need another hour.</p>
        <label className={styles.field}>Internal notes<textarea rows={7} value={notes} maxLength={8000} onChange={event => setNotes(event.target.value)} /></label>
        <button className={styles.primary} type="submit">{pending ? "Working…" : "Save lead"}</button>
      </fieldset></form>
    </section>
    <section className={styles.panel}><h2>Notification recovery</h2><p>{retryReason}</p>
      <p className={styles.muted}>At most five attempts, with backoff and a 23-hour retry window. No scheduled worker is running. Retrying uses the original email and key.</p>
      <div className={styles.actions}><button type="button" disabled={pending || !emailConfigured || !notification.retryEligible} onClick={() => void act({ action: "retry" }, "retried")}>{pending ? "Working…" : "Retry notification"}</button><a className={styles.button} href={`/ops/leads/${lead.id}`}>Refresh state</a></div>
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </>;
}
