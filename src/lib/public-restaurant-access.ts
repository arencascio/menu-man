import { restaurantShowcases } from "./restaurant-showcases";

// Route readiness and marketing-link publication live in one reviewed registry.

export function isRestaurantPublicationRestricted(
  slug: string,
  vercelEnvironment = process.env.VERCEL_ENV,
  menuManEnvironment = process.env.MENU_MAN_ENV,
) {
  return (vercelEnvironment === "production" || menuManEnvironment === "production")
    && restaurantShowcases.some((showcase) => showcase.slug === slug.toLowerCase() && !showcase.routeEnabled);
}
