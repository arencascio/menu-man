import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { isRestaurantPublicationRestricted } from "@/lib/public-restaurant-access";
import { restaurantUrl } from "@/lib/seo/restaurant-metadata";
import { isDemoRestaurant, SUPER_TACOS_SLUG } from "@/lib/demo/policy";
import { superTacosShowcase } from "@/lib/demo/presentation";
import RestaurantShell from "../RestaurantShell";
import RestaurantFooter from "../RestaurantFooter";
import RestaurantHero from "../RestaurantHero";
import RestaurantStorySection from "../RestaurantStorySection";
import { getRestaurantNavigation } from "../restaurant-navigation-actions";
import styles from "./restaurant-about-page.module.css";
import { restaurantIdentities } from "../restaurant-identity";
import { getRestaurantLocationLinks } from "../restaurant-location-data";

export const dynamic = "force-dynamic";

// Follow the existing public route's active-tenant read boundary. No writes.
const load = cache(async (slug: string) => {
  if (slug !== SUPER_TACOS_SLUG || isRestaurantPublicationRestricted(slug)) notFound();
  const { data, error } = await supabaseServer.from("restaurants")
    .select("id, slug, name, logo_url, phone, address_line1, city, state, postal_code, google_maps_url, theme_preset, theme_overrides, primary_domain, is_indexable")
    .eq("slug", slug).eq("is_active", true).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
  if (error || !data || !isDemoRestaurant(data.id)) notFound();
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await load(slug);
  return { title: `About | ${restaurant.name}`, description: superTacosShowcase.about.hero.supportingText,
    alternates: { canonical: `${restaurantUrl(slug, restaurant.primary_domain)}/about` },
    robots: restaurant.is_indexable === false ? { index: false, follow: false } : undefined };
}

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await load(slug);
  const content = superTacosShowcase.about;
  const homeHref = `/r/${restaurant.slug}`;
  const logoUrl = restaurantIdentities[slug]?.markUrl ?? restaurant.logo_url;
  const { address } = getRestaurantLocationLinks(restaurant);
  const navigation = getRestaurantNavigation({ homeHref, hasDelivery: false });
  return <RestaurantShell restaurant={{ id: restaurant.id, name: restaurant.name, logoUrl, homeHref,
    navigation, themePreset: restaurant.theme_preset, themeOverrides: restaurant.theme_overrides }}>
    <main>
      <RestaurantHero name={restaurant.name} restaurantId={restaurant.id} logoUrl={null} imageUrl={content.hero.imageUrl} presentation={{
        ...content.hero, layout: "photo-split", eyebrow: "The Super Tacos spirit", eyebrowIcon: "heart", primaryAction: { label: "Explore the menu", href: `${homeHref}/menu` },
      }} />
      <RestaurantStorySection content={content.philosophy} reverse />
      <RestaurantStorySection content={content.gathering} actionHref={`${homeHref}/menu`} />
      <p className={styles.note}>{content.note}</p>
    </main>
    <RestaurantFooter restaurantId={restaurant.id} name={restaurant.name} homeHref={homeHref} logoUrl={logoUrl}
      address={address} phone={restaurant.phone} navigation={navigation} />
  </RestaurantShell>;
}
