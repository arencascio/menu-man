import type { MetadataRoute } from "next";
import { siteUrl, isProductionSite } from "@/lib/seo/restaurant-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: isProductionSite() ? { userAgent: "*", allow: "/" } : { userAgent: "*", disallow: "/" },
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
