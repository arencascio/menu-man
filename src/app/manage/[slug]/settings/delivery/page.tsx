import { redirect } from "next/navigation";
import { listRestaurantMemberships } from "@/lib/order-management/server";
import { getDeliverySettings } from "@/lib/restaurant-settings/server";
import DeliverySettingsForm from "./DeliverySettingsForm";

export default async function DeliverySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const membership = (await listRestaurantMemberships()).find((entry) => entry.restaurantSlug === slug);
  if (!membership?.capabilities.includes("manage_restaurant_settings")) redirect("/manage");
  return <DeliverySettingsForm
    slug={slug}
    restaurantName={membership.restaurantName}
    initialSettings={await getDeliverySettings(slug)}
  />;
}
