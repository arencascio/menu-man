import { marketingOrigin } from "@/lib/seo/marketing-metadata";
import type { MetadataRoute } from "next";
import { isProductionSite } from "@/lib/seo/restaurant-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: isProductionSite() ? { userAgent: "*", allow: "/", disallow: ["/ops", "/manage", "/api/"] } : { userAgent: "*", disallow: "/" },
    sitemap: `${marketingOrigin}/sitemap.xml`,
  };
}
