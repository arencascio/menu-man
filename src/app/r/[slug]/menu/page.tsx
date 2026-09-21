import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listGuestPaymentCapabilities } from "@/lib/payments/capability-cookie";
import { getOrderPaymentView, getPaymentStatus, PaymentServerError } from "@/lib/payments/server";
import { getCustomerPaymentStatusLabel, paymentLocksCart } from "@/lib/payments/state";
import { restaurantUrl } from "@/lib/seo/restaurant-metadata";
import { supabaseServer } from "@/lib/supabase/server";
import { composeMenuSections } from "@/lib/menu-engagement/sections";
import MenuBrowser from "../MenuBrowser";
import PageViewTracker from "../PageViewTracker";
import { getRestaurantDeliveryOptions } from "../restaurant-delivery-options";
import { getRestaurantLocationLinks } from "../restaurant-location-data";
import { getRestaurantMenuSections } from "../restaurant-menu-data";
import RestaurantFooter, { type RestaurantFooterLink } from "../RestaurantFooter";
import RestaurantShell, { type RestaurantShellRestaurant } from "../RestaurantShell";
import styles from "./restaurant-menu-page.module.css";

type MenuPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: MenuPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: restaurant } = await supabaseServer
    .from("restaurants")
    .select("name, primary_domain, is_indexable")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!restaurant) return { title: "Menu | Menu Man" };

  const title = `Menu | ${restaurant.name}`;
  const description = `Explore the full menu at ${restaurant.name}.`;
  const url = `${restaurantUrl(slug, restaurant.primary_domain)}/menu`;
  return {
    title,
    description,
    robots: restaurant.is_indexable === false ? { index: false, follow: false } : undefined,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "Menu Man" },
  };
}

export default async function RestaurantMenuPage({ params }: MenuPageProps) {
  const { slug } = await params;
  const { data: restaurant, error } = await supabaseServer
    .from("restaurants")
    .select(`
      id, name, slug, currency, logo_url, phone, address_line1, city, state, postal_code,
      google_maps_url, instagram_url, facebook_url, pickup_url, theme_preset, theme_overrides
    `)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !restaurant) notFound();

  const { data: menu, error: menuError } = await supabaseServer
    .from("menus")
    .select("id, name")
    .eq("restaurant_id", restaurant.id)
    .eq("is_published", true)
    .maybeSingle();
  if (menuError || !menu) notFound();

  const [sections, deliveryOptions] = await Promise.all([
    getRestaurantMenuSections(restaurant.id, menu.id, true),
    getRestaurantDeliveryOptions(restaurant.id),
  ]);
  if (!sections) throw new Error("There was a problem loading the menu.");
  const [featuredResult, heartsResult] = await Promise.all([
    supabaseServer.from("restaurant_featured_menu_items").select("item_id, sort_order").eq("menu_id", menu.id),
    supabaseServer.from("menu_item_heart_counts").select("item_id, heart_count").eq("restaurant_id", restaurant.id),
  ]);
  if (featuredResult.error || heartsResult.error) throw new Error("There was a problem loading menu highlights.");
  const menuSections = composeMenuSections(sections, featuredResult.data ?? [], heartsResult.data ?? []);

  let initialActivePayment: { orderId: string; orderNumber: string; statusLabel: string; locksCart: true } | null = null;
  for (const capability of await listGuestPaymentCapabilities()) {
    try {
      const view = await getOrderPaymentView(slug, capability.orderId, capability.checkoutToken);
      const payment = await getPaymentStatus(capability.orderId, capability.checkoutToken);
      if (paymentLocksCart(payment)) {
        initialActivePayment = {
          orderId: capability.orderId,
          orderNumber: view.order.orderNumber,
          statusLabel: getCustomerPaymentStatusLabel(payment),
          locksCart: true,
        };
        break;
      }
    } catch (capabilityError) {
      if (!(capabilityError instanceof PaymentServerError)) throw capabilityError;
    }
  }

  const homeHref = `/r/${restaurant.slug}`;
  const { address, directionsUrl } = getRestaurantLocationLinks(restaurant);
  const phone = restaurant.phone && !restaurant.phone.includes("PLACEHOLDER") ? restaurant.phone : null;
  const shellRestaurant: RestaurantShellRestaurant = {
    id: restaurant.id,
    name: restaurant.name,
    logoUrl: restaurant.logo_url,
    homeHref,
    deliveryOptions,
    navigation: [
      { label: "Menu", href: `${homeHref}/menu` },
      { label: "Location", href: `${homeHref}/location` },
      ...(directionsUrl ? [{ label: "Directions", href: directionsUrl, external: true }] : []),
    ],
    themePreset: restaurant.theme_preset,
    themeOverrides: restaurant.theme_overrides,
  };
  const footerLinks: RestaurantFooterLink[] = [
    { label: "Menu", href: `${homeHref}/menu` },
    { label: "Location & hours", href: `${homeHref}/location` },
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
    <div className={styles.menuPage}>
      <div className={styles.heading}>
        <p>Explore the menu</p>
        <h1>{restaurant.name} menu</h1>
      </div>
      <MenuBrowser
        restaurantId={restaurant.id}
        restaurantSlug={restaurant.slug}
        currency={restaurant.currency}
        sections={menuSections}
        initialHeartCounts={Object.fromEntries((heartsResult.data ?? []).map((row) => [row.item_id, row.heart_count]))}
        ariaLabel={`${restaurant.name} ${menu.name}`}
        initialActivePayment={initialActivePayment}
      />
    </div>
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
