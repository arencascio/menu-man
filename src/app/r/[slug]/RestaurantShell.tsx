import type { CSSProperties, ReactNode } from "react";
import { resolveTheme } from "@/lib/themes/resolve-theme";
import RestaurantDeliveryChooser, { type RestaurantDeliveryOption } from "./RestaurantDeliveryChooser";
import RestaurantNavigation, { type RestaurantNavigationItem } from "./RestaurantNavigation";
import styles from "./restaurant-shell.module.css";
import RestaurantPresentationMotion from "./RestaurantPresentationMotion";
import type { RestaurantBrandLockupPresentation } from "./RestaurantBrandLockup";
import { getPublicCateringSettings } from "@/lib/catering/server";
import DemoNotice from "./DemoNotice";

export type RestaurantShellRestaurant = {
  deliveryOptions?: readonly RestaurantDeliveryOption[];
  homeHref: string;
  id: string;
  logoUrl: string | null;
  artworkMark?: boolean;
  brandLockup?: RestaurantBrandLockupPresentation;
  name: string;
  navigation: readonly RestaurantNavigationItem[];
  themeOverrides: unknown;
  themePreset: unknown;
};

type RestaurantShellProps = {
  children: ReactNode;
  restaurant: RestaurantShellRestaurant;
  smoothScroll?: boolean;
};

export default async function RestaurantShell({ children, restaurant, smoothScroll = false }: RestaurantShellProps) {
  const catering = await getPublicCateringSettings(restaurant.id);
  const navigation = catering.enabled ? [...restaurant.navigation, { label: "Catering", href: `${restaurant.homeHref}/catering` }] : restaurant.navigation;
  const theme = resolveTheme(restaurant.themePreset, restaurant.themeOverrides);
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

  return (
    <div className={`${styles.shell} ${smoothScroll ? styles.smoothScroll : ""}`} style={themeStyle}
      data-restaurant-presentation={smoothScroll || undefined}>
      {smoothScroll ? <RestaurantPresentationMotion /> : null}
      <RestaurantDeliveryChooser
        options={restaurant.deliveryOptions ?? []}
        restaurantId={restaurant.id}
      >
        <RestaurantNavigation
          restaurantId={restaurant.id}
          homeHref={restaurant.homeHref}
          items={navigation}
          logoUrl={restaurant.logoUrl}
          artworkMark={restaurant.artworkMark}
          brandLockup={restaurant.brandLockup}
          name={restaurant.name}
        />
        <DemoNotice restaurantId={restaurant.id} />
        {children}
      </RestaurantDeliveryChooser>
    </div>
  );
}
