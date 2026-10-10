import { getRestaurantNavigation } from "../restaurant-navigation-actions";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listGuestPaymentCapabilities } from "@/lib/payments/capability-cookie";
import { getOrderPaymentView, getPaymentStatus, PaymentServerError } from "@/lib/payments/server";
import { getCustomerPaymentStatusLabel, paymentLocksCart } from "@/lib/payments/state";
import { restaurantUrl } from "@/lib/seo/restaurant-metadata";
import { supabaseServer } from "@/lib/supabase/server";
import { composeMenuSections } from "@/lib/menu-engagement/sections";
import MenuBrowser from "../MenuBrowser";
import OrderingStatus from "../OrderingStatus";
import PageViewTracker from "../PageViewTracker";
import { getRestaurantDeliveryOptions } from "../restaurant-delivery-options";
import { restaurantIdentities } from "../restaurant-identity";
import { getRestaurantLocationLinks } from "../restaurant-location-data";
import { getRestaurantMenuSections } from "../restaurant-menu-data";
import RestaurantFooter from "../RestaurantFooter";
import RestaurantShell, { type RestaurantShellRestaurant } from "../RestaurantShell";
import styles from "./restaurant-menu-page.module.css";

type MenuPageProps = { params: Promise<{ slug: string }> };

function isMissingHighlightRelation(error: { code?: string; message: string } | null, relation: string) {
  return error?.code === "PGRST205" && error.message.includes(`'public.${relation}'`);
}

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
  const featuredUnavailable = isMissingHighlightRelation(featuredResult.error, "restaurant_featured_menu_items");
  const heartsUnavailable = isMissingHighlightRelation(heartsResult.error, "menu_item_heart_counts");
  if (featuredResult.error || heartsResult.error) {
    console.error("There was a problem loading menu highlights.", {
      featured: featuredResult.error,
      hearts: heartsResult.error,
    });
    if ((featuredResult.error && !featuredUnavailable) || (heartsResult.error && !heartsUnavailable)) {
      throw new Error("There was a problem loading menu highlights.");
    }
  }
  const heartCounts = heartsUnavailable ? [] : heartsResult.data ?? [];
  const menuSections = composeMenuSections(sections, featuredUnavailable ? [] : featuredResult.data ?? [], heartCounts);

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
  const identity = restaurantIdentities[slug];
  const shellRestaurant: RestaurantShellRestaurant = {
    id: restaurant.id,
    name: restaurant.name,
    logoUrl: identity?.markUrl ?? restaurant.logo_url,
    artworkMark: identity?.artworkMark,
    brandLockup: identity?.brandLockup,
    homeHref,
    deliveryOptions,
    navigation: getRestaurantNavigation({ homeHref, hasDelivery: deliveryOptions.length > 0, directionsUrl, phone }),
    themePreset: restaurant.theme_preset,
    themeOverrides: restaurant.theme_overrides,
  };

  return <RestaurantShell restaurant={shellRestaurant}>
    <div className={styles.menuPage}>
      <div className={styles.heading}>
        <div className={styles.headingVisuallyHidden}>
          <p>Explore the menu</p>
          <h1>{restaurant.name} menu</h1>
        </div>
        <OrderingStatus
          hasDelivery={deliveryOptions.length > 0}
          restaurantId={restaurant.id}
          restaurantSlug={restaurant.slug}
        />
      </div>
      <MenuBrowser
        restaurantId={restaurant.id}
        restaurantSlug={restaurant.slug}
        currency={restaurant.currency}
        sections={menuSections}
        initialHeartCounts={Object.fromEntries(heartCounts.map((row) => [row.item_id, row.heart_count]))}
        ariaLabel={`${restaurant.name} ${menu.name}`}
        initialActivePayment={initialActivePayment}
      />
    </div>
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
    <PageViewTracker restaurantId={restaurant.id} />
  </RestaurantShell>;
}
