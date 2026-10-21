import { restaurantShowcases } from "./restaurant-showcases";

// Super Tacos route readiness and marketing publication share one reviewed registry.
// Armando's route restriction is retained separately because it is not a v1 showcase.
const internallyRestrictedRestaurantSlugs = new Set(["armandos"]);

export function isRestaurantPublicationRestricted(
  slug: string,
  vercelEnvironment = process.env.VERCEL_ENV,
  menuManEnvironment = process.env.MENU_MAN_ENV,
) {
  return (vercelEnvironment === "production" || menuManEnvironment === "production")
    && (internallyRestrictedRestaurantSlugs.has(slug.toLowerCase())
      || restaurantShowcases.some((showcase) => showcase.slug === slug.toLowerCase() && !showcase.routeEnabled));
}
