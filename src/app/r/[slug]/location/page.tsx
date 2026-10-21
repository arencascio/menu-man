import { getRestaurantNavigation } from "../restaurant-navigation-actions";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { restaurantUrl, isProductionSite } from "@/lib/seo/restaurant-metadata";
import { supabaseServer } from "@/lib/supabase/server";
import PageViewTracker from "../PageViewTracker";
import { getRestaurantDeliveryOptions } from "../restaurant-delivery-options";
import { restaurantIdentities } from "../restaurant-identity";
import RestaurantFooter from "../RestaurantFooter";
import RestaurantHoursLocation from "../RestaurantHoursLocation";
import { getRestaurantHoursLocationData, getRestaurantLocationLinks } from "../restaurant-location-data";
import { restaurantLocationPresentations } from "../restaurant-location-presentation";
import RestaurantMapViews from "../RestaurantMapViews";
import RestaurantShell, { type RestaurantShellRestaurant } from "../RestaurantShell";
import { isDemoRestaurant } from "@/lib/demo/policy";
import { superTacosShowcase } from "@/lib/demo/presentation";
import styles from "../restaurant-location-page.module.css";

type LocationPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: restaurant } = await supabaseServer
    .from("restaurants")
    .select("name, description, primary_domain, is_indexable")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!restaurant) return { title: "Location | Menu Man" };

  const title = `About & Location | ${restaurant.name}`;
  const description = restaurant.description && !restaurant.description.includes("PLACEHOLDER")
    ? restaurant.description
    : `About, hours, and location for ${restaurant.name}.`;
  const url = `${restaurantUrl(slug, restaurant.primary_domain)}/location`;
  return {
    title,
    description,
    robots: !isProductionSite() || restaurant.is_indexable !== true ? { index: false, follow: false } : undefined,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "Menu Man" },
  };
}

export default async function RestaurantLocationPage({ params }: LocationPageProps) {
  const { slug } = await params;
  const { data: restaurant, error } = await supabaseServer
    .from("restaurants")
    .select(`
      id, name, slug, phone, address_line1, city, state, postal_code,
      google_maps_url, logo_url,
      theme_preset, theme_overrides, pickup_url, timezone
    `)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !restaurant) notFound();

  const [{ hours, specialHours }, deliveryOptions] = await Promise.all([
    getRestaurantHoursLocationData(restaurant.id, restaurant.timezone),
    getRestaurantDeliveryOptions(restaurant.id),
  ]);
  const { address, directionsUrl } = getRestaurantLocationLinks(restaurant);
  const presentation = restaurantLocationPresentations[slug];
  const showcase = isDemoRestaurant(restaurant.id) ? superTacosShowcase : undefined;
  const phone = restaurant.phone && !restaurant.phone.includes("PLACEHOLDER") ? restaurant.phone : null;
  const identity = restaurantIdentities[slug];
  const homeHref = `/r/${slug}`;
  const shellRestaurant: RestaurantShellRestaurant = {
    id: restaurant.id,
    name: restaurant.name,
    logoUrl: identity?.markUrl ?? restaurant.logo_url,
    artworkMark: identity?.artworkMark,
    brandLockup: identity?.brandLockup,
    homeHref,
    deliveryOptions,
    navigation: getRestaurantNavigation({ homeHref, hasDelivery: deliveryOptions.length > 0, directionsUrl, phone: showcase ? null : phone }),
    themePreset: restaurant.theme_preset,
    themeOverrides: restaurant.theme_overrides,
  };

  return <RestaurantShell restaurant={shellRestaurant} smoothScroll>
    <main>
      {showcase ? <div className={styles.demoIntro}>
        <p>Our Riverside setting</p>
        <h1>Find your next taco stop.</h1>
        <span>Explore our fictional location and the neighborhood that inspired it.</span>
      </div> : null}
      <RestaurantHoursLocation
        restaurantName={restaurant.name}
        restaurantId={restaurant.id}
        unavailableLocationMessage={isDemoRestaurant(restaurant.id) ? "No public address is listed." : undefined}
        showHeading={false}
        density="compact"
        phone={phone}
        phoneIsIllustrative={Boolean(showcase)}
        addressLine1={restaurant.address_line1}
        city={restaurant.city}
        state={restaurant.state}
        postalCode={restaurant.postal_code}
        directionsUrl={directionsUrl}
        hours={hours}
        specialHours={specialHours}
        timezone={restaurant.timezone}
      />
      <RestaurantMapViews
        restaurantName={restaurant.name}
        mapEmbedUrl={presentation?.mapEmbedUrl}
        streetViewEmbedUrl={presentation?.streetViewEmbedUrl}
        neighborhoodUrl={showcase?.location.neighborhoodUrl}
        disclosure={showcase?.location.disclosure}
      />
    </main>
    <RestaurantFooter
      navigation={shellRestaurant.navigation}
      address={address}
      directionsUrl={directionsUrl}
      homeHref={homeHref}
      logoUrl={identity?.markUrl ?? restaurant.logo_url}
      artworkMark={identity?.artworkMark}
      brandLockup={identity?.brandLockup}
      name={restaurant.name}
      phone={phone}
      restaurantId={restaurant.id}
    />
    <PageViewTracker restaurantId={restaurant.id} pageType="location" path={`/r/${encodeURIComponent(slug)}/location`} />
  </RestaurantShell>;
}
