import { redirect } from "next/navigation";
import { listRestaurantMemberships, ManagementError } from "@/lib/order-management/server";
import { getRestaurantNotificationSettings } from "@/lib/notifications/server";
import NotificationSettingsForm from "./NotificationSettingsForm";

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
  return <NotificationSettingsForm slug={slug} restaurantName={membership.restaurantName} initialSettings={settings} />;
}
