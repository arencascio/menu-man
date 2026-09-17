import { redirect } from "next/navigation";
import { listRestaurantMemberships, ManagementError } from "@/lib/order-management/server";
import ManagementNav from "../ManagementNav";
import SettingsNav from "./SettingsNav";
import sharedStyles from "../../management.module.css";
import orderStyles from "../orders/orders.module.css";
import styles from "./settings.module.css";

export default async function SettingsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let memberships;
  try { memberships = await listRestaurantMemberships(); }
  catch (error) {
    if (error instanceof ManagementError && error.code === "UNAUTHENTICATED") redirect(`/manage/login?next=${encodeURIComponent(`/manage/${slug}/settings`)}`);
    throw error;
  }
  const membership = memberships.find((entry) => entry.restaurantSlug === slug);
  if (!membership || !membership.capabilities.some((capability) => capability === "manage_restaurant_settings" || capability === "manage_notifications")) redirect("/manage");
  return <main className={sharedStyles.main}><div className={styles.page}>
    <ManagementNav slug={slug} active="settings" capabilities={membership.capabilities} />
    <header className={orderStyles.pageHeader}>
      <div><p className={orderStyles.eyebrow}>{membership.restaurantName}</p><h1 className={orderStyles.title}>Settings</h1><p className={styles.intro}>Manage restaurant details and ordering operations.</p></div>
      <div className={orderStyles.headerActions}><span className={orderStyles.identity}>{membership.displayName}</span><span className={orderStyles.role}>{membership.memberRole}</span><form action="/auth/sign-out" method="post"><button className={orderStyles.secondaryButton}>Sign out</button></form></div>
    </header>
    <SettingsNav slug={slug} capabilities={membership.capabilities} />
    {children}
  </div></main>;
}
