import type { Metadata } from "next";
export const marketingOrigin = "https://getmenuman.com";
export const marketingPages = {
  "/": { title: "Restaurant Website Design & Management | Menu Man", description: "Menu Man designs and manages restaurant websites with searchable menus, ordering links, hours, and location details. Hosting and ongoing maintenance included." },
  "/services": { title: "Restaurant Website Design & Pricing | Menu Man", description: "Explore restaurant website design and pricing from Menu Man, including managed hosting, searchable menus, routine updates, and website maintenance." },
  "/work": { title: "Restaurant Website Demo | Menu Man", description: "Try Menu Man's fictional restaurant website demo. Explore a searchable menu, hours, location details, and a simulated pickup ordering experience." },
  "/build-my-website": { title: "Get a Restaurant Website | Menu Man", description: "Tell Menu Man about your restaurant to get a managed restaurant website with a searchable menu, existing ordering links, and ongoing support." },
  "/cancellation": { title: "Cancellation & Data Handoff | Menu Man", description: "Learn what to expect when ending Menu Man's managed restaurant website service, including cancellation, billing, and a website and data handoff." },
} as const;
export function createMarketingMetadata(path: keyof typeof marketingPages): Metadata {
  const { title, description } = marketingPages[path];
  const url = marketingOrigin + (path === "/" ? "" : path);
  const images = [{ url: marketingOrigin + "/brand/menu-man-phone.png", alt: "Menu Man" }];
  return {
    metadataBase: new URL(marketingOrigin), title: { absolute: title }, description,
    alternates: { canonical: url },
    openGraph: { type: "website", title, description, url, siteName: "Menu Man", images },
    twitter: { card: "summary", title, description, images },
  };
}
export const marketingOrganization = {
  "@context": "https://schema.org", "@type": "Organization",
  "@id": marketingOrigin + "/#organization", name: "Menu Man", url: marketingOrigin,
  email: "hello@getmenuman.com", logo: marketingOrigin + "/brand/MenuManPhoneSmol.svg",
};
export const marketingService = {
  "@context": "https://schema.org", "@type": "Service", "@id": marketingOrigin + "/services#service",
  name: "Managed Restaurant Website", serviceType: "Restaurant website design and management",
  url: marketingOrigin + "/services", provider: { "@id": marketingOrganization["@id"] },
  description: "Restaurant website design, hosting, searchable menus, routine content updates, and website maintenance.",
};
