"use client";

import { useEffect, useRef, useState } from "react";
import type { CateringLead, LeadStatus } from "@/lib/catering/contracts";
import styles from "./catering-inbox.module.css";
import shared from "../../management.module.css";

type LeadPage = { leads: CateringLead[]; hasMore: boolean };
const notificationLabels: Record<CateringLead["notification_status"], string> = {
  disabled: "Email notification off", not_configured: "Email not configured", pending: "Email delivery unconfirmed", sent: "Email accepted by provider", failed: "Email attempt failed",
};
export default function CateringInbox({ slug, initialPage, canDelete = false }: { slug: string; initialPage: LeadPage; canDelete?: boolean }) {
  const [page, setPage] = useState(initialPage);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [cursor, setCursor] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const confirmationInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (deletingId) confirmationInput.current?.focus(); }, [deletingId]);
  const endpoint = `/api/manage/restaurants/${encodeURIComponent(slug)}/catering`;
  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        const response = await fetch(endpoint + cursor, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!active) return;
        if (response.status === 401 || response.status === 403) { setPage({ leads: [], hasMore: false }); setAccessLost(true); }
      } catch { /* Manual refresh remains available; do not log contact data. */ }
    };
    window.addEventListener("focus", verify);
    const timer = window.setInterval(verify, 30000);
    return () => { active = false; window.removeEventListener("focus", verify); window.clearInterval(timer); };
  }, [endpoint, cursor]);
  async function load(nextCursor: string) {
    setPending(true); setError("");
    try {
      const response = await fetch(endpoint + nextCursor, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (response.status === 401 || response.status === 403) { setPage({ leads: [], hasMore: false }); setAccessLost(true); return; }
      if (!response.ok) throw new Error();
      setPage(await response.json()); setCursor(nextCursor);
    } catch { setError("Inquiries could not be refreshed. Try again."); }
    finally { setPending(false); }
  }
  async function update(lead: CateringLead, status: LeadStatus) {
    setPending(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lead.id, status, expectedStatus: lead.status }), signal: AbortSignal.timeout(10000) });
      if (response.status === 401 || response.status === 403) { setPage({ leads: [], hasMore: false }); setAccessLost(true); return; }
      if (!response.ok) { setError("The lead could not be updated. Refresh to check for changes before retrying."); return; }
      setPage((current) => ({ ...current, leads: current.leads.map((item) => item.id === lead.id ? { ...item, status } : item) }));
    } catch { setError("The update could not be confirmed. Refresh to check its status."); }
    finally { setPending(false); }
  }
  async function remove(lead: CateringLead) {
    if (!canDelete || confirmation !== "DELETE" || pending) return;
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, expectedStatus: lead.status, confirm: confirmation }), signal: AbortSignal.timeout(10000) });
      if (response.status === 401 || response.status === 403) { setPage({ leads: [], hasMore: false }); setAccessLost(true); return; }
      if (!response.ok || (await response.json()).deleted !== true) throw new Error();
      setPage((current) => ({ ...current, leads: current.leads.filter((item) => item.id !== lead.id) }));
      setDeletingId(null); setConfirmation(""); setNotice("Inquiry permanently deleted. Its customer details have been removed from the inbox.");
    } catch { setError("Deletion could not be confirmed. Refresh to check whether the inquiry still exists before retrying."); }
    finally { setPending(false); }
  }
  if (accessLost) return <p role="alert">Your catering access is unavailable. Sign in again or contact the owner.</p>;
  return <section aria-label="Catering leads" aria-busy={pending}>
    <div className={styles.actions}><button className={shared.buttonSecondary} disabled={pending} onClick={() => void load("")}>Newest inquiries / Refresh</button></div>
    {error ? <p className={shared.error} role="alert">{error}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {!page.leads.length ? <p className={shared.empty}>No catering inquiries received yet.</p> : null}
    <div className={styles.list}>{page.leads.map((lead) => <article className={styles.card} key={lead.id}>
      <h2>{lead.name}</h2><p>Received {new Date(lead.created_at).toLocaleString()}</p>
      <dl><div><dt>Event date</dt><dd>{lead.event_date}</dd></div><div><dt>Approximate guests</dt><dd>{lead.guest_count}</dd></div>
        {lead.email ? <div><dt>Email</dt><dd>{lead.email}</dd></div> : null}
        {lead.phone ? <div><dt>Phone</dt><dd>{lead.phone}</dd></div> : null}
        {lead.event_details ? <div><dt>Event details</dt><dd>{lead.event_details}</dd></div> : null}
        {lead.notes ? <div><dt>Notes</dt><dd>{lead.notes}</dd></div> : null}
      </dl>
      <p>{notificationLabels[lead.notification_status]}. Follow up from this inbox regardless of email status.</p>
      <label>Lead status <select value={lead.status} disabled={pending} onChange={(event) => void update(lead, event.target.value as LeadStatus)}>
        <option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option>
      </select></label>
      {canDelete ? <>
        <button id={`delete-${lead.id}`} className={shared.buttonSecondary} disabled={pending} onClick={() => { setDeletingId(lead.id); setConfirmation(""); setNotice(""); }}>Delete inquiry</button>
        {deletingId === lead.id ? <form aria-label="Confirm inquiry deletion" onSubmit={(event) => { event.preventDefault(); void remove(lead); }}>
          <p id={`delete-warning-${lead.id}`}>Permanently remove this inquiry and its customer details. This cannot be undone. Notifications already in progress cannot be recalled.</p>
          <label>Type DELETE to confirm<input ref={confirmationInput} value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
            aria-describedby={`delete-warning-${lead.id}`} autoComplete="off" disabled={pending} /></label>
          <button className={shared.buttonSecondary} disabled={pending || confirmation !== "DELETE"} type="submit">Permanently delete inquiry</button>
          <button className={shared.buttonSecondary} disabled={pending} type="button" onClick={() => { setDeletingId(null); setConfirmation(""); document.getElementById(`delete-${lead.id}`)?.focus(); }}>Cancel deletion</button>
        </form> : null}
      </> : null}
    </article>)}</div>
    {page.hasMore && page.leads.length > 0 ? <button className={shared.buttonSecondary} disabled={pending} onClick={() => {
      const last = page.leads.at(-1)!;
      void load(`?${new URLSearchParams({ before: last.created_at, beforeId: last.id })}`);
    }}>Older inquiries</button> : null}
    {pending ? <p role="status">Updating catering inquiries…</p> : null}
  </section>;
}
