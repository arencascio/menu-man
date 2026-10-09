import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import RestaurantJsonLd from "@/lib/seo/RestaurantJsonLd";
import { createRestaurantMetadata } from "@/lib/seo/restaurant-metadata";
import { getMenuSectionAnchorId } from "./menu-section-anchor";
import PageViewTracker from "./PageViewTracker";
import { getRestaurantDeliveryOptions } from "./restaurant-delivery-options";
import { restaurantIdentities } from "./restaurant-identity";
import { getRestaurantHoursLocationData, getRestaurantLocationLinks } from "./restaurant-location-data";
import { getRestaurantMenuSections } from "./restaurant-menu-data";
import RestaurantAnnouncementStrip, { type RestaurantDetailItem } from "./RestaurantAnnouncementStrip";
import type { RestaurantPatternName } from "@/lib/restaurant-presentation/patterns";
import RestaurantFooter from "./RestaurantFooter";
import RestaurantPatternSeparator from "./RestaurantPatternSeparator";
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

const restaurantDetailStrips: Readonly<Partial<Record<string, {
  pattern: RestaurantPatternName;
  items: readonly RestaurantDetailItem[];
}>>> = {
  armandos: {
    pattern: "brick-wall",
    items: [
      { icon: "flag", text: "Serving Moreno Valley since 1989" },
      { icon: "utensils", text: "Menu served all day" },
      { icon: "moon", text: "Open Late" },
      { icon: "truck", text: "Available on all delivery apps" },
    ],
  },
};

type RestaurantHeroConfig = Omit<RestaurantHeroPresentation, "secondaryAction"> & {
  featuredMenuItemName?: string;
  imageUrl?: string;
};

const restaurantHeroes: Readonly<Partial<Record<string, RestaurantHeroConfig>>> = {
  armandos: {
    layout: "full-photo",
    headline: "You deserve it, amigo.",
    supportingText: "Breakfast favorites, tacos, burritos, and more.",
    imageAlt: "Carnitas tacos topped with onion and cilantro",
    imageUrl: "/img/carnitas-tacos-bg.jpg",
    imagePosition: "50% 42%",
    mobileImagePosition: "62% 45%",
    primaryAction: {
      label: "Explore the menu",
      href: "/r/armandos/menu",
    },
  },
};

type RestaurantOrderingActionsConfig = {
  description?: string;
  eyebrow?: string;
  menuAction: Extract<RestaurantOrderingAction, { href: string }>;
  title: string;
};

const restaurantOrderingActions: Readonly<Partial<Record<string, RestaurantOrderingActionsConfig>>> = {
  armandos: {
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
  eyebrow?: string;
  title: string;
  showHeading?: boolean;
  patternSeparator?: RestaurantPatternName;
  slides: readonly {
    menuItemName: string;
    imageAlt: string;
    primaryAction?: RestaurantFeaturedGalleryAction;
    secondaryAction?: RestaurantFeaturedGalleryAction;
  }[];
};

const restaurantFeaturedGalleries: Readonly<Partial<Record<string, RestaurantFeaturedGalleryConfig>>> = {
  armandos: {
    title: "Made to satisfy.",
    showHeading: false,
    patternSeparator: "brick-wall",
    slides: [
      {
        menuItemName: "Huevos a la Mexicana",
        imageAlt: "Huevos a la Mexicana with rice, beans, avocado, cucumber, and orange",
        primaryAction: { label: "View menu", href: "#restaurant-menu" },
      },
      {
        menuItemName: "Carne Asada Fries",
        imageAlt: "Carne asada fries topped with guacamole and cheese",
        primaryAction: { label: "View menu", href: "#restaurant-menu" },
      },
      {
        menuItemName: "Camarones a la Diabla",
        imageAlt: "Camarones a la Diabla with rice, beans, avocado, cucumber, and orange",
        primaryAction: { label: "View menu", href: "#restaurant-menu" },
      },
    ],
  },
};

type RestaurantMenuIntroConfig = {
  eyebrow?: string;
  title: string;
  description?: string;
  quicklinks: readonly {
    label: string;
    sectionName: string;
  }[];
};

const restaurantMenuIntros: Readonly<Partial<Record<string, RestaurantMenuIntroConfig>>> = {
  armandos: {
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

const restaurantHomepageSections: Readonly<Partial<Record<string, {
  orderingActions: boolean;
  hoursLocation: boolean;
  menuIntro: boolean;
}>>> = {
  armandos: { orderingActions: false, hoursLocation: false, menuIntro: false },
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
  const identity = restaurantIdentities[restaurant.slug];
  const phone = restaurant.phone && !restaurant.phone.includes("PLACEHOLDER") ? restaurant.phone : null;

  const restaurantPresentation: RestaurantShellRestaurant = {
    id: restaurant.id,
    name: restaurant.name,
    logoUrl: identity?.markUrl ?? restaurant.logo_url,
    artworkMark: identity?.artworkMark,
    homeHref: `/r/${restaurant.slug}`,
    deliveryOptions,
    navigation: [
      { label: "Menu", href: menuHref, icon: "utensils" },
      ...(deliveryOptions.length > 0 ? [{ kind: "delivery" as const, label: "Delivery", icon: "truck" as const }] : []),
      { label: "Location", href: `/r/${restaurant.slug}/location`, icon: "mapPinned" },
      ...(directionsUrl
        ? [{ label: "Get Directions", href: directionsUrl, external: true, icon: "navigation" as const }]
        : []),
      ...(phone ? [{ label: "Call Us", href: `tel:${phone}`, icon: "phone" as const }] : []),
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
    imagePosition: configuredHero?.imagePosition,
    mobileImagePosition: configuredHero?.mobileImagePosition,
    eyebrow: configuredHero?.eyebrow,
    headline: configuredHero?.headline ?? usableTagline ?? restaurant.name,
    supportingText: configuredHero?.supportingText,
    imageAlt: configuredHero?.imageAlt ?? `${restaurant.name} featured menu item`,
    primaryAction: configuredHero?.primaryAction ?? {
      label: "Explore the menu",
      href: menuHref,
    },
    secondaryAction: deliveryOptions.length > 0
      ? { kind: "delivery", label: "Get delivery" }
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
  const homepageSections = restaurantHomepageSections[restaurant.slug];

  return (
    <RestaurantShell restaurant={restaurantPresentation} smoothScroll>
      <RestaurantHero
        restaurantId={restaurant.id}
        name={restaurant.name}
        logoUrl={restaurant.logo_url}
        imageUrl={configuredHero?.imageUrl ?? (restaurant.hero_image_url || heroMenuImage)}
        presentation={heroPresentation}
      />
      <RestaurantAnnouncementStrip
        items={restaurantDetailStrips[restaurant.slug]?.items}
        pattern={restaurantDetailStrips[restaurant.slug]?.pattern}
      />
      {featuredGalleryConfig && featuredGallerySlides.length > 0 ? (
        <RestaurantFeaturedGallerySlider
          eyebrow={featuredGalleryConfig.eyebrow}
          restaurantId={restaurant.id}
          slides={featuredGallerySlides}
          title={featuredGalleryConfig.title}
          showHeading={featuredGalleryConfig.showHeading}
        />
      ) : null}
      {homepageSections?.orderingActions !== false && orderingActionsConfig ? (
        <RestaurantOrderingActions
          actions={orderingActions}
          description={orderingActionsConfig.description}
          eyebrow={orderingActionsConfig.eyebrow}
          restaurantId={restaurant.id}
          title={orderingActionsConfig.title}
        />
      ) : null}
      {homepageSections?.hoursLocation !== false || homepageSections?.menuIntro !== false ? (
        <div className={styles.content}>
          {homepageSections?.hoursLocation !== false ? (
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
          ) : null}
          {homepageSections?.menuIntro !== false && menuIntroConfig ? (
            <RestaurantMenuIntro
              description={menuIntroConfig.description}
              eyebrow={menuIntroConfig.eyebrow}
              quicklinks={menuQuicklinks}
              primaryAction={{ label: "View the full menu", href: menuHref }}
              title={menuIntroConfig.title}
            />
          ) : null}
        </div>
      ) : null}
      {featuredGalleryConfig?.patternSeparator && featuredGallerySlides.length > 0 ? (
        <RestaurantPatternSeparator className={styles.patternSeparator} pattern={featuredGalleryConfig.patternSeparator} />
      ) : null}
      <RestaurantFooter
        className={styles.homepageFooter}
        navigation={restaurantPresentation.navigation}
        address={address}
        directionsUrl={directionsUrl}
        homeHref={`/r/${restaurant.slug}`}
        logoUrl={identity?.markUrl ?? restaurant.logo_url}
        artworkMark={identity?.artworkMark}
        name={restaurant.name}
        phone={phone}
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
