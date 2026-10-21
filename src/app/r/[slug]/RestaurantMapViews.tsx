import styles from "./restaurant-location-page.module.css";

type RestaurantMapViewsProps = {
  eyebrow?: string;
  mapEmbedUrl?: string;
  streetViewEmbedUrl?: string;
  neighborhoodUrl?: string;
  disclosure?: string;
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

export default function RestaurantMapViews({ eyebrow, mapEmbedUrl, streetViewEmbedUrl, neighborhoodUrl, disclosure, restaurantName }: RestaurantMapViewsProps) {
  const mapUrl = validEmbedUrl(mapEmbedUrl);
  const streetViewUrl = validEmbedUrl(streetViewEmbedUrl);
  if (!mapUrl && !streetViewUrl && !neighborhoodUrl) return null;

  return <section className={styles.mapSection} aria-labelledby="restaurant-map-title">
    <div className={styles.mapInner}>
      <div className={styles.mapHeading}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h2 id="restaurant-map-title">{neighborhoodUrl ? "Explore the neighborhood" : mapUrl && streetViewUrl ? "Map & storefront" : mapUrl ? "Map" : "Storefront view"}</h2>
        {disclosure ? <p className={styles.mapDisclosure}>{disclosure}</p> : null}
      </div>
      <div className={styles.mapGrid}>
        {neighborhoodUrl ? <div className={styles.neighborhoodCard}>
          <span className={styles.neighborhoodEyebrow}>Riverside, California</span>
          <strong>Magnolia Avenue <span aria-hidden="true">×</span> Tyler Street</strong>
          <p>Discover the Magnolia Avenue and Tyler Street neighborhood.</p>
          <a href={neighborhoodUrl} target="_blank" rel="noreferrer">Open neighborhood map <span aria-hidden="true">↗</span></a>
        </div> : null}
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
