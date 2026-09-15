import { redirect } from "next/navigation";
import { listRestaurantMemberships, ManagementError } from "@/lib/order-management/server";
import { listRestaurantAccessEvents, listRestaurantTeam } from "@/lib/order-management/team-server";
import ManagementNav from "../ManagementNav";
import TeamManager from "./TeamManager";
import sharedStyles from "../../management.module.css";
import orderStyles from "../orders/orders.module.css";
import styles from "./team.module.css";

export default async function RestaurantTeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let memberships;
  try { memberships = await listRestaurantMemberships(); }
  catch (error) {
    if (error instanceof ManagementError && error.code === "UNAUTHENTICATED") redirect(`/manage/login?next=${encodeURIComponent(`/manage/${slug}/team`)}`);
    throw error;
  }
  const membership = memberships.find((entry) => entry.restaurantSlug === slug);
  if (!membership?.capabilities.includes("manage_memberships")) redirect("/manage");
  const [members, events] = await Promise.all([listRestaurantTeam(slug), listRestaurantAccessEvents(slug)]);

  return (
    <main className={sharedStyles.main}>
      <div className={styles.page}>
        <ManagementNav slug={slug} active="team" capabilities={membership.capabilities} />
        <header className={orderStyles.pageHeader}>
          <div><p className={orderStyles.eyebrow}>{membership.restaurantName}</p><h1 className={orderStyles.title}>Team</h1><p className={styles.intro}>Invite staff and control exactly what each person can do.</p></div>
          <div className={orderStyles.headerActions}><span className={orderStyles.identity}>{membership.displayName}</span><span className={orderStyles.role}>{membership.memberRole}</span><form action="/auth/sign-out" method="post"><button className={orderStyles.secondaryButton}>Sign out</button></form></div>
        </header>
        <TeamManager slug={slug} restaurantName={membership.restaurantName} actorMembershipId={membership.membershipId} actorRole={membership.memberRole} actorCapabilities={membership.capabilities} initialMembers={members} initialEvents={events} />
      </div>
    </main>
  );
}
