import { listRestaurantMemberships } from "@/lib/order-management/server";
import styles from "../management.module.css";
import orderStyles from "./orders/orders.module.css";

export default async function RestaurantManagementLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let membership;
  try {
    membership = (await listRestaurantMemberships()).find((entry) => entry.restaurantSlug === slug);
  } catch {
    // Each page retains its existing authentication and authorization handling.
    return children;
  }

  if (!membership) return children;

  return <>
    <div className={styles.accountBar}>
      <span className={orderStyles.identity}>{membership.displayName}</span>
      <span className={orderStyles.role}>{membership.memberRole}</span>
      <form action="/auth/sign-out" method="post">
        <button className={orderStyles.secondaryButton}>Sign out</button>
      </form>
    </div>
    {children}
  </>;
}
