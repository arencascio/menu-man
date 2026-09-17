import { redirect } from "next/navigation";
import { listRestaurantMemberships } from "@/lib/order-management/server";
import { getRestaurantSettings } from "@/lib/restaurant-settings/server";
import RestaurantSettingsForm from "./RestaurantSettingsForm";

export default async function RestaurantSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const membership = (await listRestaurantMemberships()).find((entry) => entry.restaurantSlug === slug);
  if (!membership?.capabilities.includes("manage_restaurant_settings")) redirect("/manage");
  return <RestaurantSettingsForm slug={slug} restaurantName={membership.restaurantName} initialSettings={await getRestaurantSettings(slug)} />;
}
