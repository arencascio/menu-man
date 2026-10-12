// Temporary publication restriction. Restaurant implementation and staging data stay intact.
export function isRestaurantPublicationRestricted(
  slug: string,
  vercelEnvironment = process.env.VERCEL_ENV,
  menuManEnvironment = process.env.MENU_MAN_ENV,
) {
  return (vercelEnvironment === "production" || menuManEnvironment === "production")
    && slug.toLowerCase() === "armandos";
}
