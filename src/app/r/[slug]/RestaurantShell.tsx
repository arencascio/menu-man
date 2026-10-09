import type { CSSProperties, ReactNode } from "react";
import { resolveTheme } from "@/lib/themes/resolve-theme";
import RestaurantDeliveryChooser, { type RestaurantDeliveryOption } from "./RestaurantDeliveryChooser";
import RestaurantNavigation, { type RestaurantNavigationItem } from "./RestaurantNavigation";
import styles from "./restaurant-shell.module.css";
import RestaurantPresentationMotion from "./RestaurantPresentationMotion";

export type RestaurantShellRestaurant = {
  deliveryOptions?: readonly RestaurantDeliveryOption[];
  homeHref: string;
  id: string;
  logoUrl: string | null;
  artworkMark?: boolean;
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

export default function RestaurantShell({ children, restaurant, smoothScroll = false }: RestaurantShellProps) {
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
          homeHref={restaurant.homeHref}
          items={restaurant.navigation}
          logoUrl={restaurant.logoUrl}
          artworkMark={restaurant.artworkMark}
          name={restaurant.name}
        />
        {children}
      </RestaurantDeliveryChooser>
    </div>
  );
}
