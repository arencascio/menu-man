import { redirect } from "next/navigation";
import { listRestaurantMemberships } from "@/lib/order-management/server";
import { getOrderingSettings } from "@/lib/restaurant-settings/server";
import OrderingSettingsForm from "./OrderingSettingsForm";

export default async function OrderingSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const membership = (await listRestaurantMemberships()).find((entry) => entry.restaurantSlug === slug);
  if (!membership?.capabilities.includes("manage_restaurant_settings")) redirect("/manage");
  return <OrderingSettingsForm slug={slug} restaurantName={membership.restaurantName} initialSettings={await getOrderingSettings(slug)} />;
}
