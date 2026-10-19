import { redirect } from "next/navigation";
import { ManagementError } from "@/lib/order-management/server";
import { loadOwnerAnalytics } from "@/lib/analytics/reporting-server";
import ManagementNav from "../ManagementNav";
import AnalyticsDashboard from "./AnalyticsDashboard";
import sharedStyles from "../../management.module.css";
import styles from "./analytics.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Restaurant analytics" };

export default async function AnalyticsPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { slug } = await params;
  const { range } = await searchParams;
  let result;
  try { result = await loadOwnerAnalytics(slug, range); }
  catch (error) {
    if (error instanceof ManagementError && error.code === "UNAUTHENTICATED") redirect(`/manage/login?next=${encodeURIComponent(`/manage/${slug}/analytics`)}`);
    if (error instanceof ManagementError && error.code === "FORBIDDEN") redirect("/manage");
    return <main className={sharedStyles.main}><section className={styles.notice} role="alert"><h1>Analytics unavailable</h1><p>We could not verify restaurant access. Refresh to try again.</p></section></main>;
  }
  const { membership, state, financialState } = result;
  return <main className={sharedStyles.main}><div className={styles.page}>
    <ManagementNav slug={membership.restaurantSlug} active="analytics" capabilities={membership.capabilities} memberRole={membership.memberRole} />
    <header className={styles.header}><div><p>{membership.restaurantName}</p><h1>Analytics</h1><p>Understand how customers use your restaurant website.</p></div></header>
    <form action={`/manage/${membership.restaurantSlug}/analytics`} method="get" className={styles.range}>
      <label htmlFor="analytics-range">Date range</label><select id="analytics-range" name="range" defaultValue={range === undefined ? "30" : typeof range === "string" && ["7", "30", "90"].includes(range) ? range : ""}>
        {range !== undefined && (typeof range !== "string" || !["7", "30", "90"].includes(range)) ? <option value="" disabled>Choose a range</option> : null}
        <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
      </select><button className={sharedStyles.button}>Update report</button>
    </form>
    <AnalyticsDashboard state={state} financialState={financialState} />
  </div></main>;
}
