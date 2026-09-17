import { redirect } from "next/navigation";
import { listRestaurantMemberships } from "@/lib/order-management/server";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const membership = (await listRestaurantMemberships()).find((entry) => entry.restaurantSlug === slug);
  redirect(membership?.capabilities.includes("manage_restaurant_settings")
    ? `/manage/${slug}/settings/restaurant`
    : `/manage/${slug}/settings/notifications`);
}
