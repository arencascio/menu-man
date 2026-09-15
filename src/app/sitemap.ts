import type { MetadataRoute } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/seo/restaurant-metadata";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let { data: restaurants, error } = await supabaseServer
    .from("restaurants")
    .select("slug")
    .eq("is_active", true)
    .eq("is_indexable", true);

  // Keep builds deployable while the forward migration is being applied. A
  // Test Kitchen row cannot exist safely before that same migration/seed.
  if (error?.code === "42703") {
    const fallback = await supabaseServer
      .from("restaurants")
      .select("slug")
      .eq("is_active", true);
    restaurants = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error(error);
    return [];
  }

  return (restaurants || []).map((restaurant) => ({
    url: `${siteUrl.replace(/\/$/, "")}/r/${restaurant.slug}`,
  }));
}
