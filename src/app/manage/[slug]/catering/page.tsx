import Link from "next/link";
import { redirect } from "next/navigation";
import { listRestaurantMemberships, ManagementError } from "@/lib/order-management/server";
import { listCateringInquiries } from "@/lib/catering/server";
import ManagementNav from "../ManagementNav";
import CateringInbox from "./CateringInbox";
import shared from "../../management.module.css";
import styles from "./catering-inbox.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catering inquiries" };
export default async function CateringInboxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let memberships;
  try { memberships = await listRestaurantMemberships(); }
  catch (error) {
    if (error instanceof ManagementError && error.code === "UNAUTHENTICATED") redirect(`/manage/login?next=${encodeURIComponent(`/manage/${slug}/catering`)}`);
    throw error;
  }
  const membership = memberships.find((entry) => entry.restaurantSlug === slug);
  if (!membership?.capabilities.includes("manage_catering")) redirect("/manage");
  let result;
  try { result = await listCateringInquiries(slug); }
  catch { return <main className={shared.main}><h1>Catering inquiries unavailable</h1><p role="alert">We could not verify access or load inquiries. Refresh to retry.</p></main>; }
  return <main className={shared.main}><div className={styles.page}>
    <ManagementNav slug={slug} active="catering" memberRole={membership.memberRole} capabilities={membership.capabilities} />
    <header className={styles.header}><div><p>{membership.restaurantName}</p><h1>Catering inquiries</h1><p>Requests for follow-up, not confirmed bookings or quotes.</p></div>
      <Link className={shared.buttonSecondary} href={`/manage/${slug}/settings/catering`}>Catering settings</Link></header>
    <CateringInbox slug={slug} initialPage={result} canDelete={membership.memberRole === "owner"} />
  </div></main>;
}
