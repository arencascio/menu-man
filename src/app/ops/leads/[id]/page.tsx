import { z } from "zod";
import { notFound } from "next/navigation";
import { getOpsLead, opsPageClient } from "@/lib/ops/server";
import { statusLabels } from "@/lib/ops/contracts";
import { NotificationState, OpsHeader, opsDate } from "../../Presentation";
import LeadActions from "./LeadActions";
import styles from "../../ops.module.css";
import { createLeadEmailLinks } from "@/lib/ops/email-links";

export default async function LeadPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = await opsPageClient();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const lead = await getOpsLead(client, id);
  if (!lead) notFound();
  const emailLinks = createLeadEmailLinks(lead.details.email);
  const result = (await searchParams).result;
  const fields = [
    ["Restaurant", lead.details.restaurantName], ["Contact name", lead.details.name], ["Email", lead.details.email],
    ["Phone", lead.details.phone], ["City", lead.details.city], ["Website", lead.details.website],
    ["No website", lead.details.noWebsite ? "Yes" : "No"], ["Online ordering", lead.details.onlineOrdering],
    ["Ordering providers", lead.details.orderingProviders], ["Help requested", lead.details.help], ["Submitted notes", lead.details.notes],
  ];
  const problem = ["failed", "retryable", "unknown"].includes(lead.notification.state)
    || (lead.notification.state === "sending" && lead.notification.retryBlock !== "leased");
  return <main className={styles.main}>
    <OpsHeader title="Lead details"><a href="/ops">← Back to inbox</a></OpsHeader>
    {(result === "saved" || result === "retried") && <p role="status" className={styles.success}>{result === "saved" ? "Lead changes saved." : "Notification attempt finished. Review its current state below."}</p>}
    {problem && <p className={styles.alert}>This inquiry is safely stored, but its email notification needs attention. Review the outcome and retry eligibility below.</p>}
    <div className={styles.columns}>
      <div className={styles.stack}>
        <section className={styles.panel}><h2>{lead.details.restaurantName}</h2><p><span className={styles.badge}>{statusLabels[lead.status]}</span></p>
          <dl className={styles.details}>{fields.map(([label, value]) => <div key={label} style={{ display: "contents" }}><dt>{label}</dt><dd>{value || "Not supplied"}</dd></div>)}</dl>
          <div className={styles.actions}><a className={styles.button} href={emailLinks.gmail} target="_blank" rel="noopener noreferrer">Email contact</a><a className={styles.button} href={emailLinks.mailto}>Use default email app</a>{lead.details.phone.replace(/[^+\d]/g, "") && <a className={styles.button} href={`tel:${lead.details.phone.replace(/[^+\d]/g, "")}`}>Call contact</a>}</div>
        </section>
        <section className={styles.panel}><h2>Submission and attribution</h2><dl className={styles.details}>
          <dt>Form</dt><dd>{lead.type === "website" ? "Build My Website" : "Free Website Review"}</dd>
          <dt>Submitted</dt><dd>{opsDate(lead.createdAt)}</dd><dt>Last updated</dt><dd>{opsDate(lead.updatedAt)}</dd>
          <dt>Follow-up</dt><dd>{opsDate(lead.followUpAt)}</dd><dt>Last contacted</dt><dd>{opsDate(lead.lastContactedAt)}</dd>
          <dt>Source page</dt><dd>{lead.sourcePage ?? "Not supplied"}</dd><dt>Email reference</dt><dd>MM-{lead.submissionId}</dd>
          {Object.entries(lead.attribution).map(([key, value]) => <div key={key} style={{ display: "contents" }}><dt>{key}</dt><dd>{value}</dd></div>)}
        </dl><p className={styles.muted}>Dates shown in Pacific time. Attribution may be absent. Gmail replies are tracked manually.</p></section>
        <section className={styles.panel}><h2>Notification history</h2><NotificationState notification={lead.notification} />
          <p className={styles.muted}>Provider acceptance is not proof of Gmail inbox delivery.</p><dl className={styles.details}>
            <dt>Attempts</dt><dd>{lead.notification.attemptCount}/5</dd><dt>Last attempt</dt><dd>{opsDate(lead.notification.lastAttemptAt)}</dd>
            <dt>Next eligible time</dt><dd>{opsDate(lead.notification.nextAttemptAt)}</dd><dt>Accepted</dt><dd>{opsDate(lead.notification.acceptedAt)}</dd>
            <dt>Error category</dt><dd>{lead.notification.errorCode ?? "None"}</dd><dt>Provider ID</dt><dd>{lead.notification.providerId ?? "Not recorded"}</dd>
          </dl><ol className={styles.timeline}>{lead.attempts.map(attempt => <li key={attempt.number}><strong>Attempt {attempt.number}: {attempt.state}</strong><p>{opsDate(attempt.startedAt)}</p><p className={styles.muted}>{attempt.errorCode ?? "No error recorded"}{attempt.httpStatus ? ` · HTTP ${attempt.httpStatus}` : ""}</p></li>)}</ol>
          {!lead.attempts.length && <p>No attempts have started.</p>}
        </section>
        <section className={styles.panel}><h2>Owner activity</h2><ol className={styles.timeline}>{lead.activity.map(activity => <li key={activity.id}>
          <strong>{activity.kind === "notification_retry" ? "Notification retry requested" : "Lead updated"}</strong><p className={styles.muted}>{opsDate(activity.created_at)}</p>
          {activity.kind === "lead_updated" && <p>Status: {String(activity.changes.previousStatus)} → {String(activity.changes.status)}. {activity.changes.notesChanged ? "Notes edited. " : ""}Follow-up: {opsDate(typeof activity.changes.followUpAt === "string" ? activity.changes.followUpAt : null)}.</p>}
        </li>)}</ol>{!lead.activity.length && <p>No owner changes yet.</p>}<p className={styles.muted}>Latest 50 changes. Actor identities and full audit history remain protected in the database.</p></section>
      </div>
      <aside className={styles.stack} aria-label="Owner actions"><LeadActions lead={{ id: lead.id, status: lead.status, notes: lead.notes, followUpAt: lead.followUpAt, revision: lead.revision, notification: lead.notification }} emailConfigured={Boolean(process.env.RESEND_API_KEY)} /></aside>
    </div>
  </main>;
}
