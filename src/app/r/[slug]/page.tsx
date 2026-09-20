import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { isMenuModifierOptionAvailable, resolveModifierPriceCents } from "@/lib/cart/cart";
import type { MenuModifierGroup } from "@/lib/cart/types";
import { resolveTheme } from "@/lib/themes/resolve-theme";
import { listGuestPaymentCapabilities } from "@/lib/payments/capability-cookie";
import { getOrderPaymentView, getPaymentStatus, PaymentServerError } from "@/lib/payments/server";
import { getCustomerPaymentStatusLabel, paymentLocksCart } from "@/lib/payments/state";
import RestaurantJsonLd from "@/lib/seo/RestaurantJsonLd";
import { createRestaurantMetadata } from "@/lib/seo/restaurant-metadata";
import { type BusinessHour } from "./BusinessHours";
import MenuBrowser, { type MenuSection } from "./MenuBrowser";
import PageViewTracker from "./PageViewTracker";
import RestaurantFooter from "./RestaurantFooter";
import RestaurantHero from "./RestaurantHero";
import RestaurantInfo from "./RestaurantInfo";
import styles from "./restaurant-page.module.css";

type RestaurantPageProps = {
  params: Promise<{
    slug: string;
  }>;
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
        doordash_url,
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
        doordash_url,
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
  const theme = resolveTheme(restaurant.theme_preset, restaurant.theme_overrides);
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
  const themeStyle = {
    "--theme-primary": theme.colors.primary,
    "--theme-accent": theme.colors.accent,
    "--theme-background": theme.colors.background,
    "--theme-surface": theme.colors.surface,
    "--theme-text": theme.colors.text,
    "--theme-muted-text": theme.colors.mutedText,
    "--theme-heading-font": theme.typography.headingFont,
    "--theme-body-font": theme.typography.bodyFont,
    "--theme-radius": theme.shape.borderRadius,
    "--theme-content-width": theme.shape.contentWidth,
    "--theme-section-gap": theme.density.sectionGap,
    "--theme-card-gap": theme.density.cardGap,
  } as CSSProperties;

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

  return (
    <div className={styles.shell} style={themeStyle}>
      <RestaurantHero
        restaurantId={restaurant.id}
        name={restaurant.name}
        tagline={restaurant.tagline}
        logoUrl={restaurant.logo_url}
        heroImageUrl={restaurant.hero_image_url}
        orderUrl={restaurant.doordash_url || restaurant.pickup_url}
        orderEvent={restaurant.doordash_url ? "delivery_clicked" : "pickup_clicked"}
        directionsUrl={directionsUrl}
      />
      <div className={styles.content}>
        <RestaurantInfo
          restaurantId={restaurant.id}
          description={restaurant.description}
          phone={restaurant.phone}
          addressLine1={restaurant.address_line1}
          city={restaurant.city}
          state={restaurant.state}
          postalCode={restaurant.postal_code}
          hours={hours}
          timezone={restaurant.timezone}
        />
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
        name={restaurant.name}
        phone={restaurant.phone}
        instagramUrl={restaurant.instagram_url}
        facebookUrl={restaurant.facebook_url}
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
    </div>
  );
}
