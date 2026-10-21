import type { RestaurantNavigationIconName } from "./RestaurantNavigationIcon";
import type { RestaurantNavigationItem } from "./RestaurantNavigation";

export function withRestaurantPresentationPages(items: readonly RestaurantNavigationItem[], homeHref: string, pages: readonly { label: string; path: string; icon?: RestaurantNavigationIconName }[] = []): readonly RestaurantNavigationItem[] {
  return [...items, ...pages.filter((page) => !items.some((item) => item.kind !== "delivery" && item.href === `${homeHref}/${page.path}`))
    .map((page) => ({ label: page.label, icon: page.icon, href: `${homeHref}/${page.path}` }))];
}

export function getRestaurantNavigation({ homeHref, hasDelivery, directionsUrl, phone }: {
  homeHref: string;
  hasDelivery: boolean;
  directionsUrl?: string | null;
  phone?: string | null;
}): readonly RestaurantNavigationItem[] {
  return [
    { label: "Menu", href: `${homeHref}/menu`, icon: "utensils" },
    ...(hasDelivery ? [{ kind: "delivery" as const, label: "Order Delivery", icon: "truck" as const }] : []),
    { label: "Location", href: `${homeHref}/location`, icon: "mapPinned" },
    ...(directionsUrl ? [{ label: "Get Directions", href: directionsUrl, external: true, icon: "navigation" as const }] : []),
    ...(phone ? [{ label: "Call Us", href: `tel:${phone}`, icon: "phone" as const }] : []),
  ];
}
