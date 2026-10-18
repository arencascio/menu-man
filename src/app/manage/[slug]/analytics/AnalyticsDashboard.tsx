import type { AnalyticsReport, ReportingState } from "@/lib/analytics/reporting";
import type { FinancialState } from "@/lib/analytics/financial-reporting";
import styles from "./analytics.module.css";

const number = (value: number) => value.toLocaleString("en-US");
const percentage = (part: number, total: number) => total ? `${(part / total * 100).toFixed(1)}%` : "Not available";
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

function FinancialSummary({ state }: { state: FinancialState }) {
  if (state.status !== "ready") return <section className={styles.notice} role="status"><h2>Orders &amp; captured sales unavailable</h2><p>We could not establish complete financial totals. Refresh to try again or contact Menu Man. No financial counts or amounts are shown.</p></section>;
  const { report } = state;
  const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
  return <section className={styles.section} aria-labelledby="financial-heading"><h2 id="financial-heading">Orders &amp; captured sales</h2>
    <p>{report.from.slice(0, 10)} through {report.until.slice(0, 10)} · UTC · {report.environment}. Today is partial, through {report.until.slice(11, 19)} UTC.</p>
    {report.environment !== "production" ? <p><strong>Test money only.</strong> Sandbox and test payments are shown; these are not live sales.</p> : null}
    <dl className={styles.metrics}>
      <Metric label="Paid orders" value={report.paidOrders} description="Orders with a positive capture first confirmed in this range, including subsequently refunded or cancelled orders." />
      <Metric label="Completed paid orders" value={report.completedPaidOrders} description="Of those paid orders, the number currently marked completed. This is not a completion-date count." />
      <Metric label="Cancelled paid orders" value={report.cancelledPaidOrders} description="Of those paid orders, the number currently cancelled. Cancellation alone does not reverse captured money." />
    </dl>
    {report.currencies.map((value) => <div key={value.currency}><h3>{value.currency} captured amounts</h3><dl className={styles.metrics}>
      <Metric label="Gross captured sales" value={money(value.grossCents, value.currency)} description="Captured payment totals by first-success time. Includes tax and tips; not profit or bank settlement." />
      <Metric label="Successful refunds" value={money(value.refundCents, value.currency)} description="Completed refunds by refund completion time, including refunds of sales before this range." />
      <Metric label="Net captured sales" value={money(value.netCents, value.currency)} description="Gross captures minus successful refunds in this range. Can be negative; fees and chargebacks are not included." />
    </dl></div>)}
    {!report.currencies.length ? <p>No captured payments or successful refunds were recorded in this range.</p> : null}
    <p>Unpaid orders, authorizations, failed attempts and pending refunds do not count as captured sales. Amounts come from payment records, never website clicks. Current fulfillment status may change; recent payment updates may take time to arrive.</p>
  </section>;
}

export default function AnalyticsDashboard({ state, financialState }: { state: ReportingState; financialState?: FinancialState }) {
  return <>{state.status !== "invalid_range" && financialState ? <FinancialSummary state={financialState} /> : null}<EngagementSummary state={state} /></>;
}

function EngagementSummary({ state }: { state: ReportingState }) {
  if (state.status === "invalid_range") return <section className={styles.notice} role="alert"><h2>Choose a reporting range</h2><p>Select 7, 30 or 90 days above.</p></section>;
  if (state.status === "unavailable") return <section className={styles.notice} role="status"><h2>Website engagement unavailable</h2>
    <p>{state.reason === "configuration" ? "Reporting is not configured yet. Ask Menu Man to connect the reporting service." : state.reason === "environment" ? "This deployment has no verified reporting environment. Ask Menu Man to check its configuration." : "We could not load reporting data. Refresh this page to try again. If the problem continues, contact Menu Man."}</p><p>No engagement counts are shown because the data is unavailable.</p></section>;
  const { report } = state;
  const { totals } = report;
  const empty = totals.pageviews + totals.itemOpenings + totals.searches + totals.delivery + totals.pickup + totals.phone + totals.directions === 0;
  const rate = totals.searches ? `${(totals.zeroResults / totals.searches * 100).toFixed(1)}%` : "Not available";
  return <>
    <p className={styles.period}>{report.from.slice(0, 10)} through {report.until.slice(0, 10)} · UTC · {report.environment}<br />Today is partial, through {report.until.slice(11, 19)} UTC. Recent activity may take time to arrive.</p>
    {empty ? <section className={styles.notice} role="status"><h2>No recorded website activity</h2><p>No matching restaurant events were received in this date range. Try another range. This does not prove nobody visited.</p></section> : null}
    <section className={styles.section} aria-labelledby="traffic-heading"><h2 id="traffic-heading">Website traffic</h2>
      <dl className={styles.metrics}><Metric label="Restaurant pageviews" value={totals.pageviews} description="Recorded page entries and revisits, including reloads." /><Metric label="Menu pageviews" value={totals.menuViews} description="Pageviews on the dedicated menu page." /></dl>
      <h3>Tracked browsers &amp; visits</h3>
      {report.audience.status === "ready" ? <>
        <dl className={styles.metrics}>
          <Metric label="Unique browsers" value={report.audience.uniqueBrowsers} description="Distinct eligible, persistent anonymous browser IDs with a recorded pageview in this range; not people." />
          <Metric label="Visits" value={report.audience.visits} description="Distinct recorded visit IDs with a pageview in this range. A new visit starts after 30 minutes of inactivity; repeat pageviews count once." />
          <Metric label="Returning browsers" value={report.audience.returningBrowsers} description="Tracked browsers with an earlier, separate recorded visit within the 90-day history lookback." />
          <Metric label="Observed return rate" value={report.audience.uniqueBrowsers ? `${(report.audience.returningBrowsers / report.audience.uniqueBrowsers * 100).toFixed(1)}%` : "Not available"} description="Returning browsers divided by unique tracked browsers. Incomplete history makes this a lower bound." />
        </dl>
        <p>Coverage among received events: {number(report.audience.trackedPageviews)} of {number(totals.pageviews)} pageviews had a valid persistent browser and visit identity. Legacy and storage-disabled events are excluded. Opt-outs and blocked delivery are not measured here.</p>
      </> : <p role="status">Tracked-browser and visit metrics are unavailable. Other website activity counts can still be used.</p>}
      <Trend report={report} />
    </section>
    <section className={styles.section} aria-labelledby="geography-heading">
      <h2 id="geography-heading">Estimated pageview geography</h2>
      <p>Approximate classifications of pageviews, not unique visitors or customers. Percentages use all restaurant pageviews in this range, including unknown and unclassified events.</p>
      {report.geography.status === "unavailable" ? <p role="status">Geographic reporting is unavailable. Refresh to try again; no geography counts are shown.</p>
        : totals.pageviews === 0 ? <p role="status">No restaurant pageviews were recorded in this date range.</p> : <>
          <dl className={styles.metrics}>
            <Metric label="Local" value={`${number(report.geography.local)} (${percentage(report.geography.local, totals.pageviews)})`} description="Estimated same city and state as the restaurant." />
            <Metric label="Same state" value={`${number(report.geography.sameState)} (${percentage(report.geography.sameState, totals.pageviews)})`} description="Estimated in the restaurant’s state, outside its city." />
            <Metric label="Out of state" value={`${number(report.geography.outOfState)} (${percentage(report.geography.outOfState, totals.pageviews)})`} description="Estimated in another U.S. state." />
            <Metric label="Unknown or unclassified" value={`${number(report.geography.unknown)} (${percentage(report.geography.unknown, totals.pageviews)})`} description="Location was unknown or unavailable, including historical pageviews without a classification." />
          </dl>
          <p>Classification coverage: {number(report.geography.classifiedPageviews)} of {number(totals.pageviews)} pageviews ({percentage(report.geography.classifiedPageviews, totals.pageviews)}). {number(report.geography.unclassifiedPageviews)} pageviews had no valid location classification; these are included in Unknown above.</p>
        </>}
    </section>
    <section className={styles.section} aria-labelledby="menu-heading"><h2 id="menu-heading">Menu engagement</h2>
      <dl className={styles.metrics}><Metric label="Item openings" value={totals.itemOpenings} description="Full-detail and quick-add openings; repeat openings count again." /><Metric label="Search interactions" value={totals.searches} description="Debounced searches, not submitted search forms." /><Metric label="Zero-result searches" value={totals.zeroResults} description="Recorded searches with no matching canonical items." /><Metric label="Zero-result rate" value={rate} description={totals.searches ? "Zero-result searches divided by recorded searches." : "A rate needs at least one recorded search."} /></dl>
      <h3>Most-opened menu items</h3>
      {report.popularItems.length ? <ol className={styles.items}>{report.popularItems.map((item) => <li key={item.itemId}><span>{item.label}</span><strong>{number(item.openings)} <small>openings</small></strong></li>)}</ol> : <p>No canonical item rankings are available for this range.</p>}
    </section>
    <section className={styles.section} aria-labelledby="actions-heading"><h2 id="actions-heading">Customer actions</h2><p>These are customer interactions, not orders, sales or completed calls.</p>
      <dl className={styles.metrics}><Metric label="Delivery-provider clicks" value={totals.delivery} description="Activations of delivery links, not chooser openings." /><Metric label="Pickup actions" value={totals.pickup} description={`${number(totals.internalPickup)} internal selections · ${number(totals.externalPickup)} external departures · ${number(totals.pickup - totals.internalPickup - totals.externalPickup)} unclassified.`} /><Metric label="Telephone clicks" value={totals.phone} description="Phone-link activations, not confirmed calls." /><Metric label="Directions clicks" value={totals.directions} description="Directions-link activations, not restaurant visits." /></dl>
    </section>
    <aside className={styles.notice}><h2>About these numbers</h2><p>These are received event counts; blockers, opt-out and delivery failures can reduce them. Browser identities last at most 90 days before rotating, and earlier visits may be missing. A browser is not a person; the same person may use several browsers.</p><p>Only this restaurant’s events in the displayed environment are included. Explicit internal QA campaign tags are excluded; untagged internal or demo activity cannot be reliably separated. Counts may begin partway through a range if tracking was introduced recently.</p></aside>
  </>;
}
