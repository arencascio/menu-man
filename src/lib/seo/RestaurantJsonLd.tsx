import type { BusinessHour } from "@/app/r/[slug]/BusinessHours";
import { restaurantUrl } from "./restaurant-metadata";

type RestaurantJsonLdProps = {
  name: string;
  slug: string;
  primaryDomain: string | null;
  description: string | null;
  phone: string | null;
  address: {
    line1: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  };
  latitude: number | null;
  longitude: number | null;
  hours: BusinessHour[];
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function RestaurantJsonLd({
  name,
  slug,
  primaryDomain,
  description,
  phone,
  address,
  latitude,
  longitude,
  hours,
}: RestaurantJsonLdProps) {
  const addressLines = [address.line1, address.city, address.state, address.postalCode].filter(Boolean);
  const addressObject = addressLines.length > 0
    ? {
        "@type": "PostalAddress",
        streetAddress: address.line1 || undefined,
        addressLocality: address.city || undefined,
        addressRegion: address.state || undefined,
        postalCode: address.postalCode || undefined,
      }
    : undefined;
  const openingHoursSpecification = hours
    .filter((hour) => !hour.is_closed && hour.open_time && hour.close_time)
    .map((hour) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: dayNames[hour.day_of_week],
      opens: hour.open_time,
      closes: hour.close_time,
    }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name,
    description: description || undefined,
    telephone: phone || undefined,
    address: addressObject,
    geo: latitude !== null && longitude !== null
      ? { "@type": "GeoCoordinates", latitude, longitude }
      : undefined,
    openingHoursSpecification: openingHoursSpecification.length > 0 ? openingHoursSpecification : undefined,
    hasMenu: restaurantUrl(slug, primaryDomain),
    url: restaurantUrl(slug, primaryDomain),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
