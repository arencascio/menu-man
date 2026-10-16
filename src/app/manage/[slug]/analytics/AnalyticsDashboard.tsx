import type { AnalyticsReport, ReportingState } from "@/lib/analytics/reporting";
import styles from "./analytics.module.css";

const number = (value: number) => value.toLocaleString("en-US");
const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

function Metric({ label, value, description }: { label: string; value: number | string; description: string }) {
  return <div className={styles.metric}><dt>{label}</dt><dd>{typeof value === "number" ? number(value) : value}<p>{description}</p></dd></div>;
}

function Trend({ report }: { report: AnalyticsReport }) {
  const max = Math.max(1, ...report.daily.map((entry) => entry.pageviews));
  const points = report.daily.map((entry, i) => `${8 + i * 584 / (report.days - 1)},${112 - entry.pageviews * 104 / max}`).join(" ");
  return <div className={styles.trend}>
    <h3>Daily pageviews</h3>
    <svg viewBox="0 0 600 120" role="img" aria-label={`Daily pageviews, ${dayLabel(report.daily[0].day)} to ${dayLabel(report.daily.at(-1)!.day)}, UTC. Exact counts are in the daily totals table.`}>
      <line x1="8" y1="112" x2="592" y2="112" stroke="#d6d3d1" />
      <polyline points={points} fill="none" stroke="#1d4ed8" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className={styles.axis}><span>{dayLabel(report.daily[0].day)}</span><span>{dayLabel(report.daily.at(-1)!.day)} · partial day</span></div>
    <details><summary>Daily totals</summary><div className={styles.tableScroll}><table>
      <caption className={styles.srOnly}>Daily restaurant pageviews and menu pageviews in UTC</caption>
      <thead><tr><th scope="col">Date (UTC)</th><th scope="col">Pageviews</th><th scope="col">Menu pageviews</th></tr></thead>
      <tbody>{report.daily.map((entry, i) => <tr key={entry.day}><th scope="row">{entry.day}{i === report.daily.length - 1 ? " (partial)" : ""}</th><td>{number(entry.pageviews)}</td><td>{number(entry.menuViews)}</td></tr>)}</tbody>
    </table></div></details>
  </div>;
}

export default function AnalyticsDashboard({ state }: { state: ReportingState }) {
  if (state.status === "invalid_range") return <section className={styles.notice} role="alert"><h2>Choose a reporting range</h2><p>Select 7, 30 or 90 days above.</p></section>;
  if (state.status === "unavailable") return <section className={styles.notice} role="status"><h2>Analytics unavailable</h2>
    <p>{state.reason === "configuration" ? "Reporting is not configured yet. Ask Menu Man to connect the reporting service." : state.reason === "environment" ? "This deployment has no verified reporting environment. Ask Menu Man to check its configuration." : "We could not load reporting data. Refresh this page to try again. If the problem continues, contact Menu Man."}</p><p>No counts are shown because the data is unavailable.</p></section>;
  const { report } = state;
  const { totals } = report;
  const empty = totals.pageviews + totals.itemOpenings + totals.searches + totals.delivery + totals.pickup + totals.phone + totals.directions === 0;
  const rate = totals.searches ? `${(totals.zeroResults / totals.searches * 100).toFixed(1)}%` : "Not available";
  return <>
    <p className={styles.period}>{report.from.slice(0, 10)} through {report.until.slice(0, 10)} · UTC · {report.environment}<br />Today is partial, through {report.until.slice(11, 19)} UTC. Recent activity may take time to arrive.</p>
    {empty ? <section className={styles.notice} role="status"><h2>No recorded activity</h2><p>No matching restaurant events were received in this date range. Try another range. This does not prove nobody visited.</p></section> : null}
    <section className={styles.section} aria-labelledby="traffic-heading"><h2 id="traffic-heading">Website traffic</h2>
      <dl className={styles.metrics}><Metric label="Restaurant pageviews" value={totals.pageviews} description="Recorded page entries and revisits, including reloads." /><Metric label="Menu pageviews" value={totals.menuViews} description="Pageviews on the dedicated menu page." /></dl>
      <Trend report={report} />
    </section>
    <section className={styles.section} aria-labelledby="menu-heading"><h2 id="menu-heading">Menu engagement</h2>
      <dl className={styles.metrics}><Metric label="Item openings" value={totals.itemOpenings} description="Full-detail and quick-add openings; repeat openings count again." /><Metric label="Search interactions" value={totals.searches} description="Debounced searches, not submitted search forms." /><Metric label="Zero-result searches" value={totals.zeroResults} description="Recorded searches with no matching canonical items." /><Metric label="Zero-result rate" value={rate} description={totals.searches ? "Zero-result searches divided by recorded searches." : "A rate needs at least one recorded search."} /></dl>
      <h3>Most-opened menu items</h3>
      {report.popularItems.length ? <ol className={styles.items}>{report.popularItems.map((item) => <li key={item.itemId}><span>{item.label}</span><strong>{number(item.openings)} <small>openings</small></strong></li>)}</ol> : <p>No canonical item rankings are available for this range.</p>}
    </section>
    <section className={styles.section} aria-labelledby="actions-heading"><h2 id="actions-heading">Customer actions</h2><p>These are customer interactions, not orders, sales or completed calls.</p>
      <dl className={styles.metrics}><Metric label="Delivery-provider clicks" value={totals.delivery} description="Activations of delivery links, not chooser openings." /><Metric label="Pickup actions" value={totals.pickup} description={`${number(totals.internalPickup)} internal selections · ${number(totals.externalPickup)} external departures · ${number(totals.pickup - totals.internalPickup - totals.externalPickup)} unclassified.`} /><Metric label="Telephone clicks" value={totals.phone} description="Phone-link activations, not confirmed calls." /><Metric label="Directions clicks" value={totals.directions} description="Directions-link activations, not restaurant visits." /></dl>
    </section>
    <aside className={styles.notice}><h2>About these numbers</h2><p>Unique browsers, returning visitors and retention are unavailable while visitor continuity is deferred. These are received event counts; blockers, opt-out and delivery failures can reduce them.</p><p>Only this restaurant’s events in the displayed environment are included. Explicit internal QA campaign tags are excluded; untagged internal or demo activity cannot be reliably separated. Counts may begin partway through a range if tracking was introduced recently.</p></aside>
  </>;
}
