import type { MetadataRoute } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/seo/restaurant-metadata";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: restaurants, error } = await supabaseServer
    .from("restaurants")
    .select("slug")
    .eq("is_active", true);

  if (error) {
    console.error(error);
    return [];
  }

  return (restaurants || []).map((restaurant) => ({
    url: `${siteUrl.replace(/\/$/, "")}/r/${restaurant.slug}`,
  }));
}