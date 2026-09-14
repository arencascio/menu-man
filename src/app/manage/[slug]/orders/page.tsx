import { redirect } from "next/navigation";
import { listManagedOrders, listRestaurantMemberships, ManagementError } from "@/lib/order-management/server";
import OrderQueue from "./OrderQueue";
import sharedStyles from "../../management.module.css";
import styles from "./orders.module.css";

export default async function ManagedOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let memberships;
  try {
    memberships = await listRestaurantMemberships();
  } catch (error) {
    if (error instanceof ManagementError && error.code === "UNAUTHENTICATED") redirect(`/manage/login?next=${encodeURIComponent(`/manage/${slug}/orders`)}`);
    throw error;
  }
  const membership = memberships.find((entry) => entry.restaurantSlug === slug);
  if (!membership || !membership.capabilities.includes("view_orders")) redirect("/manage");
  const initialPage = await listManagedOrders(slug, { view: "active", dateBasis: "placed", limit: 50 });

  return (
    <main className={sharedStyles.main}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div><p className={styles.eyebrow}>{membership.restaurantName}</p><h1 className={styles.title}>Orders</h1></div>
          <div className={styles.headerActions}><span className={styles.role}>{membership.memberRole}</span><form action="/auth/sign-out" method="post"><button className={styles.secondaryButton}>Sign out</button></form></div>
        </header>
        <OrderQueue slug={slug} restaurantId={membership.restaurantId} timezone={membership.restaurantTimezone} canAdvance={membership.capabilities.includes("advance_fulfillment")} initialPage={initialPage} />
      </div>
    </main>
  );
}
