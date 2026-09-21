import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { restaurantUrl } from "@/lib/seo/restaurant-metadata";
import { supabaseServer } from "@/lib/supabase/server";
import PageViewTracker from "../PageViewTracker";
import RestaurantAbout from "../RestaurantAbout";
import { getRestaurantDeliveryOptions } from "../restaurant-delivery-options";
import RestaurantFooter, { type RestaurantFooterLink } from "../RestaurantFooter";
import RestaurantHoursLocation from "../RestaurantHoursLocation";
import { getRestaurantHoursLocationData, getRestaurantLocationLinks } from "../restaurant-location-data";
import { restaurantLocationPresentations } from "../restaurant-location-presentation";
import RestaurantMapViews from "../RestaurantMapViews";
import RestaurantShell, { type RestaurantShellRestaurant } from "../RestaurantShell";

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
    robots: restaurant.is_indexable === false ? { index: false, follow: false } : undefined,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "Menu Man" },
  };
}

export default async function RestaurantLocationPage({ params }: LocationPageProps) {
  const { slug } = await params;
  const { data: restaurant, error } = await supabaseServer
    .from("restaurants")
    .select(`
      id, name, slug, description, phone, address_line1, city, state, postal_code,
      google_maps_url, logo_url, hero_image_url, instagram_url, facebook_url,
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
  const description = restaurant.description && !restaurant.description.includes("PLACEHOLDER")
    ? restaurant.description
    : presentation?.fallbackStory ?? "Restaurant details have not been published yet.";
  const imageUrl = restaurant.hero_image_url?.startsWith("https://")
    && !restaurant.hero_image_url.includes("PLACEHOLDER") ? restaurant.hero_image_url : null;
  const phone = restaurant.phone && !restaurant.phone.includes("PLACEHOLDER") ? restaurant.phone : null;
  const homeHref = `/r/${slug}`;
  const locationHref = `${homeHref}/location`;
  const shellRestaurant: RestaurantShellRestaurant = {
    id: restaurant.id,
    name: restaurant.name,
    logoUrl: restaurant.logo_url,
    homeHref,
    deliveryOptions,
    navigation: [
      { label: "Menu", href: `${homeHref}#restaurant-menu` },
      { label: "Location", href: locationHref },
      ...(directionsUrl ? [{ label: "Directions", href: directionsUrl, external: true }] : []),
    ],
    themePreset: restaurant.theme_preset,
    themeOverrides: restaurant.theme_overrides,
  };
  const footerLinks: RestaurantFooterLink[] = [
    { label: "Menu", href: `${homeHref}#restaurant-menu` },
    { label: "Location & hours", href: "#restaurant-information" },
    ...(deliveryOptions.length > 0
      ? [{ kind: "delivery" as const, label: "Order delivery" }]
      : restaurant.pickup_url
        ? [{ label: "Order pickup", href: restaurant.pickup_url, external: true, trackingEvent: "pickup_clicked" as const }]
        : []),
    ...(directionsUrl ? [{ label: "Directions", href: directionsUrl, external: true, trackingEvent: "directions_clicked" as const }] : []),
    ...(phone ? [{ label: "Call us", href: `tel:${phone}`, trackingEvent: "phone_clicked" as const }] : []),
    ...(restaurant.instagram_url?.startsWith("https://") && !restaurant.instagram_url.includes("PLACEHOLDER")
      ? [{ label: "Instagram", href: restaurant.instagram_url, external: true }] : []),
    ...(restaurant.facebook_url?.startsWith("https://") && !restaurant.facebook_url.includes("PLACEHOLDER")
      ? [{ label: "Facebook", href: restaurant.facebook_url, external: true }] : []),
  ];

  return <RestaurantShell restaurant={shellRestaurant}>
    <main>
      <RestaurantAbout
        eyebrow={presentation?.eyebrow ?? "About us"}
        heading={presentation?.heading ?? `Meet ${restaurant.name}.`}
        description={description}
        imageUrl={imageUrl}
        restaurantName={restaurant.name}
      />
      <RestaurantHoursLocation
        restaurantName={restaurant.name}
        restaurantId={restaurant.id}
        description={null}
        phone={phone}
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
      />
    </main>
    <RestaurantFooter
      address={address}
      homeHref={homeHref}
      links={footerLinks}
      logoUrl={restaurant.logo_url}
      name={restaurant.name}
      restaurantId={restaurant.id}
    />
    <PageViewTracker restaurantId={restaurant.id} />
  </RestaurantShell>;
}
