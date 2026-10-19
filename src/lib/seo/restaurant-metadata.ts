import type { Metadata } from "next";
import { isProductionSite, resolveSiteOrigin } from "./site-origin";

export { isProductionSite } from "./site-origin";
export const siteUrl = resolveSiteOrigin();

export function restaurantUrl(slug: string, primaryDomain: string | null) {
  if (primaryDomain && isProductionSite()) {
    const base = primaryDomain.startsWith("http") ? primaryDomain : `https://${primaryDomain}`;
    return `${base.replace(/\/$/, "")}/r/${slug}`;
  }
  return `${siteUrl.replace(/\/$/, "")}/r/${slug}`;
}

export function createRestaurantMetadata({
  name,
  slug,
  tagline,
  description,
  heroImageUrl,
  logoUrl,
  primaryDomain,
  indexable = true,
}: {
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  heroImageUrl: string | null;
  logoUrl: string | null;
  primaryDomain: string | null;
  indexable?: boolean;
}): Metadata {
  const title = `${name} | Menu`;
  const metaDescription = tagline || description || `${name} menu`;
  const url = restaurantUrl(slug, primaryDomain);
  const images = heroImageUrl || logoUrl ? [{ url: heroImageUrl || logoUrl!, alt: `${name} restaurant` }] : undefined;

  return {
    title,
    description: metaDescription,
    robots: indexable && isProductionSite() ? undefined : { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: {
      title,
      description: metaDescription,
      url,
      type: "website",
      siteName: "Menu Man",
      images,
    },
  };
}
