import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type { BusinessHour, SpecialHour } from "./BusinessHours";

type RestaurantLocationFields = {
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  google_maps_url: string | null;
};

function usablePart(value: string | null) {
  return value?.trim() && !value.includes("PLACEHOLDER") ? value.trim() : null;
}

export function getRestaurantLocationLinks(restaurant: RestaurantLocationFields) {
  const address = [
    restaurant.address_line1,
    restaurant.city,
    restaurant.state,
    restaurant.postal_code,
  ].map(usablePart).filter(Boolean).join(", ");
  const configuredUrl = restaurant.google_maps_url;
  const directionsUrl = configuredUrl?.startsWith("https://") && !configuredUrl.includes("PLACEHOLDER")
    ? configuredUrl
    : address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null;
  return { address: address || null, directionsUrl };
}

export async function getRestaurantHoursLocationData(
  restaurantId: string,
  timezone: string | null,
): Promise<{ hours: BusinessHour[]; specialHours: SpecialHour[] }> {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone || "UTC",
    year: "numeric",
  }).format(new Date());

  const [hoursResult, specialHoursResult] = await Promise.all([
    supabaseServer
      .from("restaurant_business_hours")
      .select("day_of_week, open_time, close_time, is_closed, sort_order")
      .eq("restaurant_id", restaurantId)
      .order("day_of_week", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabaseServer
      .from("restaurant_special_hours")
      .select("service_date, label, open_time, close_time, is_closed")
      .eq("restaurant_id", restaurantId)
      .gte("service_date", localDate)
      .order("service_date", { ascending: true })
      .limit(6),
  ]);

  if (hoursResult.error) console.error(hoursResult.error);
  if (specialHoursResult.error && !["42P01", "PGRST205"].includes(specialHoursResult.error.code)) {
    console.error(specialHoursResult.error);
  }

  return {
    hours: hoursResult.data ?? [],
    specialHours: specialHoursResult.data ?? [],
  };
}
