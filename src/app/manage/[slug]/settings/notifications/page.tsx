import { redirect } from "next/navigation";
import { listRestaurantMemberships, ManagementError } from "@/lib/order-management/server";
import { getRestaurantNotificationSettings } from "@/lib/notifications/server";
import ManagementNav from "../../ManagementNav";
import NotificationSettingsForm from "./NotificationSettingsForm";
import sharedStyles from "../../../management.module.css";
import orderStyles from "../../orders/orders.module.css";
import styles from "./notifications.module.css";

export default async function NotificationSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let memberships;
  try { memberships = await listRestaurantMemberships(); }
  catch (error) {
    if (error instanceof ManagementError && error.code === "UNAUTHENTICATED") {
      redirect(`/manage/login?next=${encodeURIComponent(`/manage/${slug}/settings/notifications`)}`);
    }
    throw error;
  }
  const membership = memberships.find((entry) => entry.restaurantSlug === slug);
  if (!membership?.capabilities.includes("manage_notifications")) redirect("/manage");
  const settings = await getRestaurantNotificationSettings(slug);
  return (
    <main className={sharedStyles.main}>
      <div className={styles.page}>
        <ManagementNav slug={slug} active="notifications" capabilities={membership.capabilities} />
        <header className={orderStyles.pageHeader}>
          <div><p className={orderStyles.eyebrow}>{membership.restaurantName}</p><h1 className={orderStyles.title}>Notifications</h1><p className={styles.intro}>Choose which Menu Man operational emails are sent.</p></div>
          <div className={orderStyles.headerActions}><span className={orderStyles.identity}>{membership.displayName}</span><span className={orderStyles.role}>{membership.memberRole}</span><form action="/auth/sign-out" method="post"><button className={orderStyles.secondaryButton}>Sign out</button></form></div>
        </header>
        <NotificationSettingsForm slug={slug} restaurantName={membership.restaurantName} initialSettings={settings} />
      </div>
    </main>
  );
}
