import styles from "./restaurant-location-page.module.css";

type RestaurantMapViewsProps = {
  mapEmbedUrl?: string;
  streetViewEmbedUrl?: string;
  restaurantName: string;
};

function validEmbedUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "www.google.com"
      && url.pathname === "/maps/embed" && url.searchParams.has("pb") ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function RestaurantMapViews({ mapEmbedUrl, streetViewEmbedUrl, restaurantName }: RestaurantMapViewsProps) {
  const mapUrl = validEmbedUrl(mapEmbedUrl);
  const streetViewUrl = validEmbedUrl(streetViewEmbedUrl);
  if (!mapUrl && !streetViewUrl) return null;

  return <section className={styles.mapSection} aria-labelledby="restaurant-map-title">
    <div className={styles.mapInner}>
      <div className={styles.mapHeading}>
        <p className={styles.eyebrow}>See the location</p>
        <h2 id="restaurant-map-title">Find your way here.</h2>
        <p>{mapUrl && streetViewUrl
          ? "Explore the map and take a look at the storefront before you visit."
          : mapUrl ? "Explore the map before you visit." : "Take a look at the storefront before you visit."}</p>
      </div>
      <div className={styles.mapGrid}>
        {mapUrl ? <div className={styles.mapCard}>
          <h3>Map</h3>
          <iframe
            title={`Map of ${restaurantName}`}
            src={mapUrl}
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div> : null}
        {streetViewUrl ? <div className={styles.mapCard}>
          <h3>Storefront view</h3>
          <iframe
            title={`Street View of ${restaurantName}`}
            src={streetViewUrl}
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div> : null}
      </div>
    </div>
  </section>;
}
