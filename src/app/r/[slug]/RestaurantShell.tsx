import type { CSSProperties, ReactNode } from "react";
import { resolveTheme } from "@/lib/themes/resolve-theme";
import RestaurantDeliveryChooser, { type RestaurantDeliveryOption } from "./RestaurantDeliveryChooser";
import RestaurantNavigation, { type RestaurantNavigationItem } from "./RestaurantNavigation";
import styles from "./restaurant-shell.module.css";
import RestaurantPresentationMotion from "./RestaurantPresentationMotion";
import type { RestaurantBrandLockupPresentation } from "./RestaurantBrandLockup";
import { getPublicCateringSettings } from "@/lib/catering/server";
import DemoNotice from "./DemoNotice";
import { isDemoRestaurant } from "@/lib/demo/policy";
import { superTacosShowcase } from "@/lib/demo/presentation";
import { withRestaurantPresentationPages } from "./restaurant-navigation-actions";
import { superTacosBrandFont } from "@/lib/demo/brand-font";

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
  navigationVariant?: "solid" | "transparent";
};

export default async function RestaurantShell({ children, restaurant, smoothScroll = false, navigationVariant }: RestaurantShellProps) {
  const showcase = isDemoRestaurant(restaurant.id) ? superTacosShowcase : undefined;
  const headerVariant = navigationVariant ?? (showcase ? "solid" : undefined);
  const catering = await getPublicCateringSettings(restaurant.id);
  const baseNavigation = showcase && !restaurant.navigation.some((item) => item.kind === "delivery")
    ? [...restaurant.navigation, { kind: "delivery" as const, label: "Order Delivery", icon: "truck" as const }]
    : restaurant.navigation;
  const presentationNavigation = withRestaurantPresentationPages(baseNavigation, restaurant.homeHref, showcase?.pages);
  const navigation = catering.enabled
    ? withRestaurantPresentationPages(presentationNavigation, restaurant.homeHref, [{ label: "Catering", path: "catering" }])
    : presentationNavigation;
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
        illustrativeOptions={showcase && !restaurant.deliveryOptions?.length ? showcase.deliveryOptions : undefined}
        restaurantId={restaurant.id}
      >
        <RestaurantNavigation
          variant={headerVariant}
          shrinkOnScroll={showcase?.shrinkNavigationOnScroll}
          restaurantId={restaurant.id}
          homeHref={restaurant.homeHref}
          items={navigation}
          logoUrl={restaurant.logoUrl}
          wordmarkOnly={showcase?.wordmarkOnly}
          wordmarkClassName={showcase ? superTacosBrandFont.className : undefined}
          wordmarkFontFamily={showcase ? superTacosBrandFont.style.fontFamily : undefined}
          artworkMark={restaurant.artworkMark}
          brandLockup={restaurant.brandLockup}
          name={restaurant.name}
        />
        {showcase ? <a className={`${styles.menuManReturn} ${navigationVariant === "transparent" ? styles.menuManReturnAfterOverlay : ""}`} href="https://getmenuman.com/">← Back to Menu Man</a> : null}
        <DemoNotice restaurantId={restaurant.id} />
        {children}
      </RestaurantDeliveryChooser>
    </div>
  );
}
