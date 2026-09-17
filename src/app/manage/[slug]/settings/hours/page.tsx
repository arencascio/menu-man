import { redirect } from "next/navigation";
import { listRestaurantMemberships } from "@/lib/order-management/server";
import { getHoursSettings } from "@/lib/restaurant-settings/server";
import HoursSettingsForm from "./HoursSettingsForm";

export default async function HoursSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const membership = (await listRestaurantMemberships()).find((entry) => entry.restaurantSlug === slug);
  if (!membership?.capabilities.includes("manage_restaurant_settings")) redirect("/manage");
  return <HoursSettingsForm slug={slug} restaurantName={membership.restaurantName} initialSettings={await getHoursSettings(slug)} />;
}
