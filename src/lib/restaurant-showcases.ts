import { SUPER_TACOS_ID } from "./demo/policy";

// Open a verified permanent route first; publish its marketing link only after
// unauthenticated hosted QA. Neither switch grants commerce permissions.
export const restaurantShowcases = [
  {
    slug: "super-tacos", name: "Super Tacos", routeEnabled: true, published: true,
    eyebrow: "BOLD FOOD. A BRAND TO MATCH.",
    description: "A custom restaurant website with a searchable menu, item customization, simulated checkout, and a catering request form.",
    image: "/img/super-tacos/approved/carnitas-tacos.webp", imageAlt: "The approved Super Tacos homepage hero photograph of freshly prepared tacos",
    disclosure: "Fictional restaurant demo",
  },
] as const;

export function getShowcaseHref(showcase: { slug: string; routeEnabled: boolean; published: boolean }) {
  return showcase.routeEnabled && showcase.published ? `/r/${showcase.slug}` : null;
}

// A presentation capability, independent of database item orderability. The
// ordinary restaurant cart remains browser-local; this never authorizes an RPC.
export function isShowcaseCartPreview(restaurantId: string) {
  return restaurantId === SUPER_TACOS_ID;
}

export function canCustomizeMenuItem(orderable: boolean, cartPreview = false) {
  return orderable || cartPreview;
}
