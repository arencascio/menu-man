import BusinessHours, { type BusinessHour } from "./BusinessHours";
import styles from "./restaurant-page.module.css";
import TrackedRestaurantLink from "./TrackedRestaurantLink";

type RestaurantInfoProps = {
  restaurantId: string;
  description: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  hours: BusinessHour[];
  timezone: string | null;
};

export default function RestaurantInfo({
  restaurantId,
  description,
  phone,
  addressLine1,
  city,
  state,
  postalCode,
  hours,
  timezone,
}: RestaurantInfoProps) {
  const location = [addressLine1, city, state, postalCode].filter(Boolean).join(", ");

  return (
    <section className={styles.info} aria-label="Restaurant information">
      <div>
        <h2>About</h2>
        <p className={description ? styles.description : `${styles.description} ${styles.placeholderText}`}>
          {description || "PLACEHOLDER: Add verified restaurant and community information here."}
        </p>
      </div>
      <div className={styles.details}>
        <div className={styles.detail}>
          <strong>Location</strong>
          {location ? <span>{location}</span> : <span className={styles.placeholderText}>Address not provided</span>}
        </div>
        <div className={styles.detail}>
          <strong>Contact</strong>
          {phone ? (
            <TrackedRestaurantLink
              href={`tel:${phone}`}
              eventName="phone_clicked"
              restaurantId={restaurantId}
            >
              {phone}
            </TrackedRestaurantLink>
          ) : <span className={styles.placeholderText}>Phone not provided</span>}
        </div>
        <BusinessHours hours={hours} timezone={timezone} />
      </div>
    </section>
  );
}
