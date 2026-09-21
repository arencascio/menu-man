import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import RestaurantJsonLd from "@/lib/seo/RestaurantJsonLd";
import { createRestaurantMetadata } from "@/lib/seo/restaurant-metadata";
import { getMenuSectionAnchorId } from "./menu-section-anchor";
import PageViewTracker from "./PageViewTracker";
import { getRestaurantDeliveryOptions } from "./restaurant-delivery-options";
import { getRestaurantHoursLocationData, getRestaurantLocationLinks } from "./restaurant-location-data";
import { getRestaurantMenuSections } from "./restaurant-menu-data";
import RestaurantFooter, { type RestaurantFooterLink } from "./RestaurantFooter";
import RestaurantFeaturedGallerySlider, {
  type RestaurantFeaturedGalleryAction,
  type RestaurantFeaturedGallerySlide,
} from "./RestaurantFeaturedGallerySlider";
import RestaurantHoursLocation from "./RestaurantHoursLocation";
import RestaurantHero, { type RestaurantHeroPresentation } from "./RestaurantHero";
import RestaurantMenuIntro, { type RestaurantMenuQuicklink } from "./RestaurantMenuIntro";
import RestaurantOrderingActions, { type RestaurantOrderingAction } from "./RestaurantOrderingActions";
import RestaurantShell, { type RestaurantShellRestaurant } from "./RestaurantShell";
import styles from "./restaurant-page.module.css";

type RestaurantPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const restaurantAnnouncements: Readonly<Partial<Record<string, readonly string[]>>> = {
  armandos: [
    "Breakfast served all day",
    "Search our full menu online",
  ],
};

type RestaurantHeroConfig = Omit<RestaurantHeroPresentation, "secondaryAction"> & {
  featuredMenuItemName?: string;
};

const restaurantHeroes: Readonly<Partial<Record<string, RestaurantHeroConfig>>> = {
  armandos: {
    layout: "photo-split",
    eyebrow: "Armando's Mexican Food",
    headline: "You deserve it, amigo.",
    supportingText: "Breakfast favorites, street tacos, burritos, combination plates, and more—all in one menu.",
    imageAlt: "Five carnitas street tacos from Armando's Mexican Food",
    featuredMenuItemName: "5 Carnitas Street Tacos Special",
    primaryAction: {
      label: "Explore the menu",
      href: "#restaurant-menu",
    },
  },
};

type RestaurantOrderingActionsConfig = {
  description: string;
  eyebrow: string;
  menuAction: Extract<RestaurantOrderingAction, { href: string }>;
  title: string;
};

const restaurantOrderingActions: Readonly<Partial<Record<string, RestaurantOrderingActionsConfig>>> = {
  armandos: {
    eyebrow: "Start your order",
    title: "Your favorites are a few taps away.",
    description: "Browse Armando's full menu, find what sounds good, and build your order in one place.",
    menuAction: {
      label: "View the menu",
      description: "Search breakfast, tacos, burritos, combination plates, and more.",
      href: "#restaurant-menu",
    },
  },
};

type RestaurantFeaturedGalleryConfig = {
  eyebrow: string;
  title: string;
  slides: readonly {
    menuItemName: string;
    imageAlt: string;
    primaryAction?: RestaurantFeaturedGalleryAction;
    secondaryAction?: RestaurantFeaturedGalleryAction;
  }[];
};

const restaurantFeaturedGalleries: Readonly<Partial<Record<string, RestaurantFeaturedGalleryConfig>>> = {
  armandos: {
    eyebrow: "Featured favorites",
    title: "Made to satisfy.",
    slides: [
      {
        menuItemName: "Huevos a la Mexicana",
        imageAlt: "Huevos a la Mexicana with rice, beans, avocado, cucumber, and orange",
        primaryAction: { label: "View the menu", href: "#restaurant-menu" },
      },
      {
        menuItemName: "Carne Asada Fries",
        imageAlt: "Carne asada fries topped with guacamole and cheese",
        primaryAction: { label: "View the menu", href: "#restaurant-menu" },
      },
      {
        menuItemName: "Camarones a la Diabla",
        imageAlt: "Camarones a la Diabla with rice, beans, avocado, cucumber, and orange",
        primaryAction: { label: "View the menu", href: "#restaurant-menu" },
      },
    ],
  },
};

type RestaurantMenuIntroConfig = {
  eyebrow: string;
  title: string;
  description: string;
  quicklinks: readonly {
    label: string;
    sectionName: string;
  }[];
};

const restaurantMenuIntros: Readonly<Partial<Record<string, RestaurantMenuIntroConfig>>> = {
  armandos: {
    eyebrow: "The full menu",
    title: "Find your next favorite.",
    description: "From breakfast served all day to street tacos, burritos, loaded fries, and combination plates—start with a favorite or explore everything.",
    quicklinks: [
      { label: "Breakfast", sectionName: "Breakfast Plates" },
      { label: "Burritos", sectionName: "Burritos" },
      { label: "Street tacos", sectionName: "Street Tacos" },
      { label: "Loaded favorites", sectionName: "Carne Asada Fries, Nachos, Quesadillas & Sides" },
      { label: "Combination plates", sectionName: "Combination Plates" },
    ],
  },
};

export async function generateMetadata({ params }: RestaurantPageProps): Promise<Metadata> {
  const { slug } = await params;
  let { data: restaurant, error } = await supabaseServer
    .from("restaurants")
    .select("name, slug, tagline, description, logo_url, hero_image_url, primary_domain, is_indexable")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error?.code === "42703") {
    const fallback = await supabaseServer
      .from("restaurants")
      .select("name, slug, tagline, description, logo_url, hero_image_url, primary_domain")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    restaurant = fallback.data ? { ...fallback.data, is_indexable: true } : null;
    error = fallback.error;
  }

  if (error || !restaurant) {
    return { title: "Restaurant menu | Menu Man" };
  }

  return createRestaurantMetadata({
    name: restaurant.name,
    slug: restaurant.slug,
    tagline: restaurant.tagline,
    description: restaurant.description,
    heroImageUrl: restaurant.hero_image_url,
    logoUrl: restaurant.logo_url,
    primaryDomain: restaurant.primary_domain,
    indexable: restaurant.is_indexable,
  });
}

export default async function RestaurantPage({
  params,
}: RestaurantPageProps) {
  const { slug } = await params;

  let { data: restaurant, error: restaurantError } =
    await supabaseServer
      .from("restaurants")
      .select(`
        id,
        name,
        slug,
        currency,
        timezone,
        logo_url,
        hero_image_url,
        tagline,
        description,
        phone,
        address_line1,
        city,
        state,
        postal_code,
        latitude,
        longitude,
        pickup_url,
        google_maps_url,
        instagram_url,
        facebook_url,
        primary_color,
        accent_color,
        theme_preset,
        theme_overrides,
        primary_domain,
        is_indexable
      `)
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

  if (restaurantError?.code === "42703") {
    const fallback = await supabaseServer
      .from("restaurants")
      .select(`
        id,
        name,
        slug,
        currency,
        timezone,
        logo_url,
        hero_image_url,
        tagline,
        description,
        phone,
        address_line1,
        city,
        state,
        postal_code,
        latitude,
        longitude,
        pickup_url,
        google_maps_url,
        instagram_url,
        facebook_url,
        primary_color,
        accent_color,
        theme_preset,
        theme_overrides,
        primary_domain
      `)
      .eq("slug", slug)
      .eq("is_active", true)
      .single();
    restaurant = fallback.data ? { ...fallback.data, is_indexable: true } : null;
    restaurantError = fallback.error;
  }

if (restaurantError || !restaurant) {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Restaurant not found</h1>

      <pre>
        {JSON.stringify(
          {
            slug,
            restaurantError,
            restaurant,
          },
          null,
          2
        )}
      </pre>
    </main>
  );
}

  const { data: menu, error: menuError } =
    await supabaseServer
      .from("menus")
      .select("id, name")
      .eq("restaurant_id", restaurant.id)
      .eq("is_published", true)
      .single();

  if (menuError || !menu) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>{restaurant.name}</h1>
        <p>No published menu found.</p>
      </main>
    );
  }

  const menuSections = await getRestaurantMenuSections(restaurant.id, menu.id);
  if (!menuSections) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>{restaurant.name}</h1>
        <p>There was a problem loading the menu.</p>
      </main>
    );
  }

  const [{ hours, specialHours }, deliveryOptions] = await Promise.all([
    getRestaurantHoursLocationData(restaurant.id, restaurant.timezone),
    getRestaurantDeliveryOptions(restaurant.id),
  ]);
  const { address, directionsUrl } = getRestaurantLocationLinks(restaurant);
  const menuHref = `/r/${restaurant.slug}/menu`;

  const restaurantPresentation: RestaurantShellRestaurant = {
    id: restaurant.id,
    name: restaurant.name,
    logoUrl: restaurant.logo_url,
    homeHref: `/r/${restaurant.slug}`,
    announcements: restaurantAnnouncements[restaurant.slug] ?? [],
    deliveryOptions,
    navigation: [
      { label: "Menu", href: menuHref },
      { label: "Location", href: `/r/${restaurant.slug}/location` },
      ...(directionsUrl
        ? [{ label: "Directions", href: directionsUrl, external: true }]
        : []),
    ],
    themePreset: restaurant.theme_preset,
    themeOverrides: restaurant.theme_overrides,
  };
  const configuredHero = restaurantHeroes[restaurant.slug];
  const heroMenuImage = configuredHero?.featuredMenuItemName
    ? menuSections
        .flatMap((section) => section.items)
        .find((item) => item.name === configuredHero.featuredMenuItemName)?.image_url ?? null
    : null;
  const usableTagline = restaurant.tagline && !restaurant.tagline.includes("PLACEHOLDER")
    ? restaurant.tagline
    : null;
  const heroPresentation: RestaurantHeroPresentation = {
    layout: configuredHero?.layout ?? "photo-split",
    eyebrow: configuredHero?.eyebrow ?? restaurant.name,
    headline: configuredHero?.headline ?? usableTagline ?? restaurant.name,
    supportingText: configuredHero?.supportingText ?? "Browse the menu and restaurant information.",
    imageAlt: configuredHero?.imageAlt ?? `${restaurant.name} featured menu item`,
    primaryAction: configuredHero?.primaryAction ?? {
      label: "Explore the menu",
      href: "#restaurant-menu",
    },
    secondaryAction: deliveryOptions.length > 0
      ? { kind: "delivery", label: "Order delivery" }
      : restaurant.pickup_url
        ? {
            label: "Order pickup",
            href: restaurant.pickup_url,
            external: true,
            trackingEvent: "pickup_clicked",
          }
        : undefined,
  };
  const orderingActionsConfig = restaurantOrderingActions[restaurant.slug];
  const orderingActions: RestaurantOrderingAction[] = orderingActionsConfig
    ? [
        { ...orderingActionsConfig.menuAction, href: menuHref },
        ...(restaurant.pickup_url
          ? [{
              label: "Order pickup",
              description: "Place a pickup order online.",
              href: restaurant.pickup_url,
              external: true,
              trackingEvent: "pickup_clicked" as const,
            }]
          : []),
        ...(deliveryOptions.length > 0
          ? [{
              kind: "delivery" as const,
              label: "Order delivery",
              description: "Choose a delivery provider and continue to place your order.",
            }]
          : []),
      ]
    : [];
  const featuredGalleryConfig = restaurantFeaturedGalleries[restaurant.slug];
  const featuredGallerySlides: RestaurantFeaturedGallerySlide[] = featuredGalleryConfig
    ? featuredGalleryConfig.slides.flatMap((configuredSlide) => {
        const menuItem = menuSections
          .flatMap((section) => section.items)
          .find((item) => item.name === configuredSlide.menuItemName);
        if (!menuItem?.image_url) return [];

        return [{
          imageUrl: menuItem.image_url,
          imageAlt: configuredSlide.imageAlt,
          title: menuItem.name,
          description: menuItem.description ?? undefined,
          primaryAction: configuredSlide.primaryAction
            ? { ...configuredSlide.primaryAction, href: menuHref }
            : undefined,
          secondaryAction: configuredSlide.secondaryAction,
        }];
      })
    : [];
  const menuIntroConfig = restaurantMenuIntros[restaurant.slug];
  const menuQuicklinks: RestaurantMenuQuicklink[] = menuIntroConfig
    ? menuIntroConfig.quicklinks.flatMap((configuredQuicklink) => {
        const section = menuSections.find(({ name }) => name === configuredQuicklink.sectionName);
        if (!section) return [];

        return [{
          label: configuredQuicklink.label,
          href: `${menuHref}#${getMenuSectionAnchorId(section.id)}`,
        }];
      })
    : [];
  const hasUsablePhone = restaurant.phone && !restaurant.phone.includes("PLACEHOLDER");
  const usableInstagramUrl = restaurant.instagram_url?.startsWith("http")
    && !restaurant.instagram_url.includes("PLACEHOLDER")
    ? restaurant.instagram_url
    : null;
  const usableFacebookUrl = restaurant.facebook_url?.startsWith("http")
    && !restaurant.facebook_url.includes("PLACEHOLDER")
    ? restaurant.facebook_url
    : null;
  const footerLinks: RestaurantFooterLink[] = [
    { label: "Menu", href: menuHref },
    { label: "Location & hours", href: `/r/${restaurant.slug}/location` },
    ...(deliveryOptions.length > 0
      ? [{
          kind: "delivery" as const,
          label: "Order delivery",
        }]
      : restaurant.pickup_url
        ? [{
            label: "Order pickup",
            href: restaurant.pickup_url,
            external: true,
            trackingEvent: "pickup_clicked" as const,
          }]
      : []),
    ...(directionsUrl
      ? [{
          label: "Directions",
          href: directionsUrl,
          external: true,
          trackingEvent: "directions_clicked" as const,
        }]
      : []),
    ...(hasUsablePhone
      ? [{
          label: "Call us",
          href: `tel:${restaurant.phone}`,
          trackingEvent: "phone_clicked" as const,
        }]
      : []),
    ...(usableInstagramUrl
      ? [{ label: "Instagram", href: usableInstagramUrl, external: true }]
      : []),
    ...(usableFacebookUrl
      ? [{ label: "Facebook", href: usableFacebookUrl, external: true }]
      : []),
  ];

  return (
    <RestaurantShell restaurant={restaurantPresentation}>
      <RestaurantHero
        restaurantId={restaurant.id}
        name={restaurant.name}
        logoUrl={restaurant.logo_url}
        imageUrl={restaurant.hero_image_url || heroMenuImage}
        presentation={heroPresentation}
      />
      {featuredGalleryConfig && featuredGallerySlides.length > 0 ? (
        <RestaurantFeaturedGallerySlider
          eyebrow={featuredGalleryConfig.eyebrow}
          restaurantId={restaurant.id}
          slides={featuredGallerySlides}
          title={featuredGalleryConfig.title}
        />
      ) : null}
      {orderingActionsConfig ? (
        <RestaurantOrderingActions
          actions={orderingActions}
          description={orderingActionsConfig.description}
          eyebrow={orderingActionsConfig.eyebrow}
          restaurantId={restaurant.id}
          title={orderingActionsConfig.title}
        />
      ) : null}
      <div className={styles.content}>
        <RestaurantHoursLocation
          restaurantName={restaurant.name}
          restaurantId={restaurant.id}
          description={restaurant.description}
          phone={restaurant.phone}
          addressLine1={restaurant.address_line1}
          city={restaurant.city}
          state={restaurant.state}
          postalCode={restaurant.postal_code}
          directionsUrl={directionsUrl}
          hours={hours}
          specialHours={specialHours}
          timezone={restaurant.timezone}
        />
        {menuIntroConfig ? (
          <RestaurantMenuIntro
            description={menuIntroConfig.description}
            eyebrow={menuIntroConfig.eyebrow}
            quicklinks={menuQuicklinks}
            primaryAction={{ label: "View the full menu", href: menuHref }}
            title={menuIntroConfig.title}
          />
        ) : null}
      </div>
      <RestaurantFooter
        address={address}
        homeHref={`/r/${restaurant.slug}`}
        links={footerLinks}
        logoUrl={restaurant.logo_url}
        name={restaurant.name}
        restaurantId={restaurant.id}
      />
      <RestaurantJsonLd
        name={restaurant.name}
        slug={restaurant.slug}
        primaryDomain={restaurant.primary_domain}
        description={restaurant.description}
        phone={restaurant.phone}
        address={{
          line1: restaurant.address_line1,
          city: restaurant.city,
          state: restaurant.state,
          postalCode: restaurant.postal_code,
        }}
        latitude={restaurant.latitude}
        longitude={restaurant.longitude}
        hours={hours}
      />
      <PageViewTracker restaurantId={restaurant.id} />
    </RestaurantShell>
  );
}
