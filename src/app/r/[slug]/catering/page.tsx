import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getPublicCateringSettings } from "@/lib/catering/server";
import { isRestaurantPublicationRestricted } from "@/lib/public-restaurant-access";
import { restaurantUrl } from "@/lib/seo/restaurant-metadata";
import RestaurantShell from "../RestaurantShell";
import RestaurantFooter from "../RestaurantFooter";
import { restaurantIdentities } from "../restaurant-identity";
import { getRestaurantNavigation } from "../restaurant-navigation-actions";
import PageViewTracker from "../PageViewTracker";
import CateringPageContent from "./CateringPageContent";
import RestaurantCateringPreview from "./RestaurantCateringPreview";
import { isDemoRestaurant } from "@/lib/demo/policy";
import { superTacosShowcase } from "@/lib/demo/presentation";
import { getRestaurantLocationLinks } from "../restaurant-location-data";

export const dynamic = "force-dynamic";
async function load(slug: string) {
  if (isRestaurantPublicationRestricted(slug)) notFound();
  const { data, error } = await supabaseServer.from("restaurants").select("id, slug, name, logo_url, phone, address_line1, city, state, postal_code, google_maps_url, theme_preset, theme_overrides, timezone, primary_domain, is_indexable").eq("slug", slug).eq("is_active", true).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
  if (error || !data) notFound();
  const settings = await getPublicCateringSettings(data.id);
  const preview = isDemoRestaurant(data.id) ? superTacosShowcase.catering : undefined;
  if (!settings.enabled && !preview) notFound();
  return { restaurant: data, settings, preview };
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { restaurant, settings, preview } = await load(slug);
  return { title: `${preview ? "Catering showcase" : settings.heading} | ${restaurant.name}`, description: preview?.description ?? settings.description,
    alternates: { canonical: `${restaurantUrl(slug, restaurant.primary_domain)}/catering` },
    robots: restaurant.is_indexable === false ? { index: false, follow: false } : undefined };
}
export default async function CateringPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { restaurant, settings, preview } = await load(slug);
  const identity = restaurantIdentities[slug];
  const homeHref = `/r/${slug}`;
  const navigation = getRestaurantNavigation({ homeHref, hasDelivery: false });
  const logoUrl = identity?.markUrl ?? restaurant.logo_url;
  const { address, directionsUrl } = getRestaurantLocationLinks(restaurant);
  return <RestaurantShell restaurant={{ id: restaurant.id, name: restaurant.name, homeHref, logoUrl, artworkMark: identity?.artworkMark, brandLockup: identity?.brandLockup,
    navigation, themePreset: restaurant.theme_preset, themeOverrides: restaurant.theme_overrides }}>
    {preview ? <RestaurantCateringPreview content={preview} restaurantId={restaurant.id} name={restaurant.name} menuHref={`${homeHref}/menu`} />
      : <CateringPageContent settings={settings} slug={slug} restaurantId={restaurant.id} timezone={restaurant.timezone || "UTC"} />}
    <RestaurantFooter homeHref={homeHref} name={restaurant.name} restaurantId={restaurant.id} logoUrl={logoUrl}
      artworkMark={identity?.artworkMark} brandLockup={identity?.brandLockup} navigation={navigation}
      address={address} directionsUrl={directionsUrl} phone={restaurant.phone} />
    <PageViewTracker restaurantId={restaurant.id} pageType="catering" path={`/r/${encodeURIComponent(slug)}/catering`} />
  </RestaurantShell>;
}
