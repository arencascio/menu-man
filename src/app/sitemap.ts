import type { MetadataRoute } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { siteUrl, isProductionSite } from "@/lib/seo/restaurant-metadata";
import { isRestaurantPublicationRestricted } from "@/lib/public-restaurant-access";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const marketingRoutes: MetadataRoute.Sitemap = [
    "",
    "/services",
    "/work",
    "/build-my-website",
  ].map((path) => ({ url: `${siteUrl.replace(/\/$/, "")}${path}` }));

  // Nonproduction must not advertise staging tenants, even if a fixture is indexable.
  if (!isProductionSite()) return marketingRoutes;

  const { data: restaurants, error } = await supabaseServer
    .from("restaurants")
    .select("slug")
    .eq("is_active", true)
    .eq("is_indexable", true);

  if (error) {
    console.error("Sitemap restaurant lookup unavailable.");
    return marketingRoutes;
  }

  return marketingRoutes.concat((restaurants || []).filter((restaurant) => !isRestaurantPublicationRestricted(restaurant.slug)).map((restaurant) => ({
    url: `${siteUrl.replace(/\/$/, "")}/r/${restaurant.slug}`,
  })));
}
