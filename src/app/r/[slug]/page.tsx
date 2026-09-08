import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveTheme } from "@/lib/themes/resolve-theme";
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
  const { data: restaurant } = await supabaseServer
    .from("restaurants")
    .select("name, slug, tagline, description, logo_url, hero_image_url, primary_domain")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!restaurant) {
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
  });
}

export default async function RestaurantPage({
  params,
}: RestaurantPageProps) {
  const { slug } = await params;

  const { data: restaurant, error: restaurantError } =
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
        primary_domain
      `)
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

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
            image_path
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
            currency={restaurant.currency}
            sections={menuSections}
            ariaLabel={`${restaurant.name} ${menu.name}`}
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