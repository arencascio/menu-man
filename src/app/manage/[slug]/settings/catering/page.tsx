import { redirect } from "next/navigation";
import { listRestaurantMemberships } from "@/lib/order-management/server";
import { getManagedCateringSettings } from "@/lib/catering/server";
import CateringSettingsForm from "./CateringSettingsForm";

export default async function CateringSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const membership = (await listRestaurantMemberships()).find((entry) => entry.restaurantSlug === slug);
  if (!membership?.capabilities.includes("manage_catering")) redirect("/manage");
  return <CateringSettingsForm slug={slug} restaurantName={membership.restaurantName} initialSettings={await getManagedCateringSettings(slug)} />;
}
