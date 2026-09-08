import styles from "./restaurant-page.module.css";
import { trackEvent } from "@/lib/analytics/client";

type RestaurantHeroProps = {
  restaurantId: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  orderUrl: string | null;
  orderEvent: "delivery_clicked" | "pickup_clicked";
  directionsUrl: string | null;
};

export default function RestaurantHero({
  restaurantId,
  name,
  tagline,
  logoUrl,
  heroImageUrl,
  orderUrl,
  orderEvent,
  directionsUrl,
}: RestaurantHeroProps) {
  return (
    <header className={styles.hero}>
      {heroImageUrl ? (
        <div className={styles.heroImage} style={{ backgroundImage: `url(${heroImageUrl})` }} aria-hidden="true" />
      ) : (
        <div className={styles.heroImagePlaceholder} aria-hidden="true" />
      )}
      <div className={styles.heroContent}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.logo} src={logoUrl} alt={`${name} logo`} />
        ) : (
          <div className={`${styles.logo} ${styles.logoPlaceholder}`} aria-label={`${name} logo placeholder`}>
            {name.charAt(0)}
          </div>
        )}
        <p className={styles.eyebrow}>Restaurant menu</p>
        <h1>{name}</h1>
        {tagline ? <p className={styles.tagline}>{tagline}</p> : <p className={styles.tagline}>Menu and restaurant information</p>}
        <div className={styles.heroActions}>
          {orderUrl ? (
            <a className={styles.primaryAction} href={orderUrl} target="_blank" rel="noreferrer" onClick={() => trackEvent({ name: orderEvent, restaurantId })}>
              Order online
            </a>
          ) : (
            <span className={`${styles.primaryAction} ${styles.disabledAction}`}>Order online unavailable</span>
          )}
          {directionsUrl ? (
            <a className={styles.secondaryAction} href={directionsUrl} target="_blank" rel="noreferrer" onClick={() => trackEvent({ name: "directions_clicked", restaurantId })}>
              Get directions
            </a>
          ) : (
            <span className={`${styles.secondaryAction} ${styles.disabledAction}`}>Directions unavailable</span>
          )}
        </div>
      </div>
    </header>
  );
}
