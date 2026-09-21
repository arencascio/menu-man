import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type { RestaurantDeliveryOption } from "./RestaurantDeliveryChooser";

function isValidDeliveryUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.toLowerCase().includes("placeholder")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function getRestaurantDeliveryOptions(restaurantId: string): Promise<RestaurantDeliveryOption[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_delivery_providers")
    .select("display_name, destination_url, image_url, sort_order")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) console.error(error);

  return (data ?? []).flatMap((provider) => isValidDeliveryUrl(provider.destination_url) ? [{
    displayName: provider.display_name,
    imageUrl: provider.image_url ?? undefined,
    supportingLabel: `Continue to ${provider.display_name} to place your order.`,
    url: provider.destination_url,
  }] : []);
}
