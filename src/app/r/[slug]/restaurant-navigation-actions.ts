import type { RestaurantNavigationItem } from "./RestaurantNavigation";

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
