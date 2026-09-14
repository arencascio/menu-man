import Link from "next/link";
import { redirect } from "next/navigation";
import { listRestaurantMemberships, ManagementError } from "@/lib/order-management/server";
import styles from "./management.module.css";

export default async function ManagementHomePage() {
  let memberships;
  try {
    memberships = await listRestaurantMemberships();
  } catch (error) {
    if (error instanceof ManagementError && error.code === "UNAUTHENTICATED") redirect("/manage/login");
    throw error;
  }
  if (memberships.length === 1) redirect(`/manage/${memberships[0].restaurantSlug}/orders`);
  if (memberships.length === 0) {
    return <main className={styles.main}><section className={styles.empty}><h1>No restaurant access</h1><p className={styles.muted}>Your sign-in is valid, but it does not have an active restaurant membership. Ask an owner or Menu Man operator for access.</p><form action="/auth/sign-out" method="post"><button className={styles.buttonSecondary} style={{ marginTop: 18 }}>Sign out</button></form></section></main>;
  }
  return (
    <main className={styles.main}>
      <section className={styles.restaurantList}>
        <h1>Choose a restaurant</h1>
        {memberships.map((membership) => (
          <Link className={styles.restaurantLink} key={membership.membershipId} href={`/manage/${membership.restaurantSlug}/orders`}>
            <span><strong>{membership.restaurantName}</strong><br /><small>{membership.memberRole}</small></span><span aria-hidden>→</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
