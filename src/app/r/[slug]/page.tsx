import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { isMenuModifierOptionAvailable, resolveModifierPriceCents } from "@/lib/cart/cart";
import type { MenuModifierGroup } from "@/lib/cart/types";
import { listGuestPaymentCapabilities } from "@/lib/payments/capability-cookie";
import { getOrderPaymentView, getPaymentStatus, PaymentServerError } from "@/lib/payments/server";
import { getCustomerPaymentStatusLabel, paymentLocksCart } from "@/lib/payments/state";
import RestaurantJsonLd from "@/lib/seo/RestaurantJsonLd";
import { createRestaurantMetadata } from "@/lib/seo/restaurant-metadata";
import { type BusinessHour, type SpecialHour } from "./BusinessHours";
import MenuBrowser, { type MenuSection } from "./MenuBrowser";
import { getMenuSectionAnchorId } from "./menu-section-anchor";
import PageViewTracker from "./PageViewTracker";
import type { RestaurantDeliveryOption } from "./RestaurantDeliveryChooser";
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

function isValidDeliveryUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.includes("PLACEHOLDER")) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

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
  menuAction: RestaurantOrderingAction;
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

  const { data: sections, error: sectionsError } =
    await supabaseServer
      .from("menu_sections")
      .select(`
        id,
        name,
        description,
        sort_order,
        menu_section_items (
          sort_order,
          menu_items (
            id,
            name,
            description,
            price_cents,
            source_image_url,
            image_path,
            is_orderable
          )
        )
      `)
      .eq("menu_id", menu.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

  if (sectionsError) {
    console.error(sectionsError);

    return (
      <main style={{ padding: "2rem" }}>
        <h1>{restaurant.name}</h1>
        <p>There was a problem loading the menu.</p>
      </main>
    );
  }

  const [modifierGroupsResult, modifierOptionsResult, modifierAttachmentsResult, modifierOverridesResult] = await Promise.all([
    supabaseServer
      .from("modifier_groups")
      .select("id, name, description, is_active")
      .eq("restaurant_id", restaurant.id),
    supabaseServer
      .from("modifier_options")
      .select("id, modifier_group_id, name, default_price_adjustment_cents, sort_order, is_default, is_active")
      .eq("restaurant_id", restaurant.id),
    supabaseServer
      .from("menu_item_modifier_groups")
      .select("menu_item_id, modifier_group_id, min_selections, max_selections, sort_order, is_active")
      .eq("restaurant_id", restaurant.id),
    supabaseServer
      .from("menu_item_modifier_option_overrides")
      .select("menu_item_id, modifier_option_id, price_adjustment_cents, sort_order, is_active")
      .eq("restaurant_id", restaurant.id),
  ]);

  const modifierErrors = [
    modifierGroupsResult.error,
    modifierOptionsResult.error,
    modifierAttachmentsResult.error,
    modifierOverridesResult.error,
  ].filter(Boolean);
  if (modifierErrors.length > 0) {
    console.error("There was a problem loading menu modifiers.", modifierErrors);
  }

  const modifierGroupsById = new Map(
    (modifierGroupsResult.data || []).map((group) => [group.id, group]),
  );
  const modifierOptionsByGroupId = new Map<string, NonNullable<typeof modifierOptionsResult.data>>();
  for (const option of modifierOptionsResult.data || []) {
    const options = modifierOptionsByGroupId.get(option.modifier_group_id) || [];
    options.push(option);
    modifierOptionsByGroupId.set(option.modifier_group_id, options);
  }
  const modifierOverridesByItemAndOption = new Map(
    (modifierOverridesResult.data || []).map((override) => [
      `${override.menu_item_id}:${override.modifier_option_id}`,
      override,
    ]),
  );
  const modifierAttachmentsByItemId = new Map<string, NonNullable<typeof modifierAttachmentsResult.data>>();
  for (const attachment of modifierAttachmentsResult.data || []) {
    const attachments = modifierAttachmentsByItemId.get(attachment.menu_item_id) || [];
    attachments.push(attachment);
    modifierAttachmentsByItemId.set(attachment.menu_item_id, attachments);
  }

  function getItemModifierGroups(menuItemId: string): MenuModifierGroup[] {
    return (modifierAttachmentsByItemId.get(menuItemId) || [])
      .flatMap((attachment) => {
        const group = modifierGroupsById.get(attachment.modifier_group_id);
        if (!group || !group.is_active || !attachment.is_active) return [];
        const options = (modifierOptionsByGroupId.get(group.id) || [])
          .flatMap((option) => {
            const override = modifierOverridesByItemAndOption.get(`${menuItemId}:${option.id}`);
            if (!isMenuModifierOptionAvailable(
              group.is_active,
              option.is_active,
              attachment.is_active,
              override?.is_active,
            )) return [];
            return [{
              id: option.id,
              name: option.name,
              priceAdjustmentCents: resolveModifierPriceCents(
                override?.price_adjustment_cents,
                option.default_price_adjustment_cents,
              ),
              sortOrder: override?.sort_order ?? option.sort_order,
              isDefault: option.is_default,
            }];
          })
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

        return [{
          id: group.id,
          name: group.name,
          description: group.description,
          minSelections: attachment.min_selections,
          maxSelections: attachment.max_selections,
          sortOrder: attachment.sort_order,
          options,
        }];
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }

  const { data: businessHours, error: businessHoursError } = await supabaseServer
    .from("restaurant_business_hours")
    .select("day_of_week, open_time, close_time, is_closed, sort_order")
    .eq("restaurant_id", restaurant.id)
    .order("day_of_week", { ascending: true })
    .order("sort_order", { ascending: true });

  if (businessHoursError) {
    console.error(businessHoursError);
  }

  const hours: BusinessHour[] = businessHours || [];
  const localDate = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: restaurant.timezone || "UTC",
    year: "numeric",
  }).format(new Date());
  const { data: specialHoursData, error: specialHoursError } = await supabaseServer
    .from("restaurant_special_hours")
    .select("service_date, label, open_time, close_time, is_closed")
    .eq("restaurant_id", restaurant.id)
    .gte("service_date", localDate)
    .order("service_date", { ascending: true })
    .limit(6);

  const specialHoursTableUnavailable = specialHoursError
    && ["42P01", "PGRST205"].includes(specialHoursError.code);
  if (specialHoursError && !specialHoursTableUnavailable) {
    console.error(specialHoursError);
  }

  const specialHours: SpecialHour[] = specialHoursData || [];
  const { data: deliveryProviderRows, error: deliveryProvidersError } = await supabaseServer
    .from("restaurant_delivery_providers")
    .select("display_name, destination_url, image_url, sort_order")
    .eq("restaurant_id", restaurant.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (deliveryProvidersError) {
    console.error(deliveryProvidersError);
  }
  const address = [
    restaurant.address_line1,
    restaurant.city,
    restaurant.state,
    restaurant.postal_code,
  ].filter(Boolean).join(", ");
  const hasUsableAddress = address && !address.includes("PLACEHOLDER");
  const directionsUrl = restaurant.google_maps_url || (
    hasUsableAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null
  );
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
    } catch (error) {
      if (!(error instanceof PaymentServerError)) throw error;
    }
  }
  const menuSections: MenuSection[] = (sections || []).map((section) => ({
    id: section.id,
    name: section.name,
    description: section.description,
    sort_order: section.sort_order,
    items: (section.menu_section_items || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((placement) => {
        const item = placement.menu_items;
        const items = Array.isArray(item) ? item : item ? [item] : [];
        return items.map((menuItem) => ({
          ...menuItem,
          modifierGroups: getItemModifierGroups(menuItem.id),
          image_url: menuItem.image_path
            ? supabaseServer.storage.from("restaurant-assets").getPublicUrl(menuItem.image_path).data.publicUrl
            : menuItem.source_image_url,
        }));
      }),
  }));

  const deliveryOptions: RestaurantDeliveryOption[] = (deliveryProviderRows ?? []).flatMap((provider) => {
    if (!isValidDeliveryUrl(provider.destination_url)) return [];

    return [{
      displayName: provider.display_name,
      imageUrl: provider.image_url ?? undefined,
      supportingLabel: `Continue to ${provider.display_name} to place your order.`,
      url: provider.destination_url,
    }];
  });
  const restaurantPresentation: RestaurantShellRestaurant = {
    id: restaurant.id,
    name: restaurant.name,
    logoUrl: restaurant.logo_url,
    homeHref: `/r/${restaurant.slug}`,
    announcements: restaurantAnnouncements[restaurant.slug] ?? [],
    deliveryOptions,
    navigation: [
      { label: "Menu", href: "#restaurant-menu" },
      { label: "About & hours", href: "#restaurant-information" },
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
        orderingActionsConfig.menuAction,
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
          primaryAction: configuredSlide.primaryAction,
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
          href: `#${getMenuSectionAnchorId(section.id)}`,
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
    { label: "Menu", href: "#restaurant-menu" },
    { label: "Location & hours", href: "#restaurant-information" },
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
            title={menuIntroConfig.title}
          />
        ) : null}
        <div className={styles.menuRegion}>
          <MenuBrowser
            restaurantId={restaurant.id}
            restaurantSlug={restaurant.slug}
            currency={restaurant.currency}
            sections={menuSections}
            ariaLabel={`${restaurant.name} ${menu.name}`}
            initialActivePayment={initialActivePayment}
          />
        </div>
      </div>
      <RestaurantFooter
        address={hasUsableAddress ? address : null}
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
