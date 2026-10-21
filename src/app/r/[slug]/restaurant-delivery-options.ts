import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { isMissingOptionalRelation } from "@/lib/supabase/optional-relation";
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
    .select("id, display_name, provider_key, destination_url, image_url, sort_order")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    if (isMissingOptionalRelation(error, "restaurant_delivery_providers")) return [];
    throw error;
  }

  return (data ?? []).flatMap((provider) => isValidDeliveryUrl(provider.destination_url) ? [{
    providerId: provider.id,
    displayName: provider.display_name,
    imageUrl: provider.image_url ?? undefined,
    providerKey: provider.provider_key ?? undefined,
    supportingLabel: `Continue to ${provider.display_name} to place your order.`,
    url: provider.destination_url,
  }] : []);
}
