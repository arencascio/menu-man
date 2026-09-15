import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data: restaurant } = await supabaseServer
    .from("restaurants")
    .select("is_indexable")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return restaurant?.is_indexable === false
    ? { robots: { index: false, follow: false } }
    : {};
}

export default function RestaurantRouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
