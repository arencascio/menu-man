import { supabaseServer } from "@/lib/supabase/server";
import { createRestaurantGeographyHandler } from "@/lib/analytics/restaurant-geography";

export const dynamic = "force-dynamic";

const handle = createRestaurantGeographyHandler({
  vercel: process.env.VERCEL,
  vercelEnv: process.env.VERCEL_ENV,
  async lookupRestaurant(restaurantId) {
    const { data, error } = await supabaseServer.from("restaurants")
      .select("city, state")
      .eq("id", restaurantId)
      .eq("is_active", true)
      .maybeSingle();
    return error || !data ? null : { city: data.city, state: data.state };
  },
});

export function POST(request: Request) {
  return handle(request);
}
