// Temporary publication restriction. Restaurant implementation and staging data stay intact.
const restrictedRestaurantSlugs = new Set(["armandos", "super-tacos"]);

export function isRestaurantPublicationRestricted(
  slug: string,
  vercelEnvironment = process.env.VERCEL_ENV,
  menuManEnvironment = process.env.MENU_MAN_ENV,
) {
  return (vercelEnvironment === "production" || menuManEnvironment === "production")
    && restrictedRestaurantSlugs.has(slug.toLowerCase());
}
