import { querySchema, statusLabels, statuses } from "@/lib/ops/contracts";
import { listOpsLeads, opsPageClient } from "@/lib/ops/server";
import { OpsHeader, NotificationState, opsDate } from "./Presentation";
import styles from "./ops.module.css";

export default async function OpsInbox({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const client = await opsPageClient();
  const params = await searchParams;
  const parsed = querySchema.safeParse(Object.fromEntries(["view", "status", "type", "sort", "page"].flatMap(key => params[key] === undefined ? [] : [[key, params[key]]])));
  const query = parsed.success ? parsed.data : querySchema.parse({});
  const inbox = await listOpsLeads(client, query);
  const pageHref = (page: number) => `/ops?${new URLSearchParams({ ...query, page: String(page) })}`;
  return <main className={styles.main}>
    <OpsHeader title="Lead inbox"><p className={styles.muted}>Private owner workspace. Dates shown in Pacific time.</p></OpsHeader>
    <nav className={styles.summary} aria-label="Lead summary">
      <a href="/ops?view=all&status=new"><strong>{inbox.summary.new}</strong>New leads</a>
      <a href="/ops?view=due"><strong>{inbox.summary.due}</strong>Follow-ups due</a>
      <a href="/ops?view=notifications"><strong>{inbox.summary.failed}</strong>Failed / uncertain email</a>
    </nav>
    {inbox.summary.failed > 0 && <p className={styles.alert}>Email needs attention for {inbox.summary.failed} lead{inbox.summary.failed === 1 ? "" : "s"}. The inquiries are safely stored. <a href="/ops?view=notifications">Review notifications</a></p>}
    <form className={styles.filters} method="get" action="/ops">
      <label className={styles.field}>View<select name="view" defaultValue={query.view}><option value="open">Unresolved</option><option value="all">All leads</option><option value="due">Follow-ups due</option><option value="notifications">Email problems</option></select></label>
      <label className={styles.field}>Status<select name="status" defaultValue={query.status}><option value="all">All statuses</option>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
      <label className={styles.field}>Inquiry<select name="type" defaultValue={query.type}><option value="all">Both forms</option><option value="website">Build My Website</option><option value="review">Free Website Review</option></select></label>
      <label className={styles.field}>Sort<select name="sort" defaultValue={query.sort}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="follow_up">Follow-up date</option></select></label>
      <button type="submit" className={styles.primary}>Apply filters</button><a href="/ops">Reset</a>
    </form>
    <p className={styles.muted}>{query.view === "due" ? "Overdue follow-ups on unresolved leads." : query.view === "open" ? "New, Contacted, and Waiting leads. Resolved leads are available in All leads." : "Filtered lead inbox."}</p>
    <section aria-label="Leads" className={styles.list}>
      {inbox.items.slice(0, 25).map(lead => <article key={lead.id} className={styles.lead}>
        <div><h2><a href={`/ops/leads/${lead.id}`}>{lead.restaurant}</a></h2><p>{lead.contact || "Contact name not supplied"}</p><p className={styles.muted}>{lead.type === "website" ? "Build My Website" : "Free Website Review"}</p></div>
        <div><span className={styles.label}>Submitted</span><time dateTime={lead.createdAt}>{opsDate(lead.createdAt)}</time></div>
        <div><span className={styles.badge}>{statusLabels[lead.status]}</span><span className={styles.label}>Follow-up</span><span className={lead.overdue ? styles.due : ""}>{opsDate(lead.followUpAt)}</span></div>
        <div><span className={styles.label}>Notification</span><NotificationState notification={lead.notification} /><p className={styles.muted}>{lead.notification.attemptCount}/5 attempts</p></div>
      </article>)}
      {!inbox.items.length && <p className={styles.empty}>No leads match this view.</p>}
    </section>
    <nav aria-label="Inbox pages" className={styles.pagination}>{query.page > 1 ? <a className={styles.button} href={pageHref(query.page - 1)}>Previous</a> : <span />}<span>Page {query.page}</span>{inbox.items.length > 25 ? <a className={styles.button} href={pageHref(query.page + 1)}>Next</a> : <span />}</nav>
  </main>;
}
