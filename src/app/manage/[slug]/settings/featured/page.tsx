import { redirect } from "next/navigation";
import { listRestaurantMemberships } from "@/lib/order-management/server";
import { getFeaturedSettings } from "@/lib/restaurant-settings/server";
import FeaturedSettingsForm from "./FeaturedSettingsForm";

export default async function FeaturedSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const membership = (await listRestaurantMemberships()).find((entry) => entry.restaurantSlug === slug);
  if (!membership?.capabilities.includes("manage_restaurant_settings")) redirect("/manage");
  return <FeaturedSettingsForm slug={slug} restaurantName={membership.restaurantName} initialSettings={await getFeaturedSettings(slug)} />;
}
