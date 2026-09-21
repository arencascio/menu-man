import BusinessHours, { type BusinessHour, type SpecialHour } from "./BusinessHours";
import styles from "./restaurant-hours-location.module.css";
import TrackedRestaurantLink from "./TrackedRestaurantLink";

type RestaurantHoursLocationProps = {
  addressLine1: string | null;
  city: string | null;
  description: string | null;
  directionsUrl: string | null;
  hours: readonly BusinessHour[];
  phone: string | null;
  postalCode: string | null;
  restaurantId: string;
  restaurantName: string;
  specialHours: readonly SpecialHour[];
  state: string | null;
  timezone: string | null;
};

function isUsableValue(value: string | null) {
  return Boolean(value && !value.includes("PLACEHOLDER"));
}

export default function RestaurantHoursLocation({
  addressLine1,
  city,
  description,
  directionsUrl,
  hours,
  phone,
  postalCode,
  restaurantId,
  restaurantName,
  specialHours,
  state,
  timezone,
}: RestaurantHoursLocationProps) {
  const addressParts = [addressLine1, city, state, postalCode].filter(isUsableValue);
  const hasAddress = addressParts.length > 0;
  const usableDescription = isUsableValue(description) ? description : null;

  return (
    <section
      id="restaurant-information"
      className={styles.section}
      aria-labelledby="restaurant-information-title"
    >
      <div className={styles.inner}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Hours &amp; location</p>
          <h2 id="restaurant-information-title">Visit {restaurantName}</h2>
          {usableDescription ? <p className={styles.description}>{usableDescription}</p> : null}
        </div>

        <div className={styles.grid}>
          <div className={styles.locationCard}>
            <p className={styles.cardLabel}>Find us</p>
            {hasAddress ? (
              <address className={styles.address}>{addressParts.join(", ")}</address>
            ) : (
              <p className={styles.unavailable}>Location details have not been published yet.</p>
            )}

            {phone ? (
              <div className={styles.contact}>
                <span>Call us</span>
                <TrackedRestaurantLink
                  href={`tel:${phone}`}
                  eventName="phone_clicked"
                  restaurantId={restaurantId}
                >
                  {phone}
                </TrackedRestaurantLink>
              </div>
            ) : null}

            {directionsUrl ? (
              <TrackedRestaurantLink
                className={styles.directionsAction}
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                eventName="directions_clicked"
                restaurantId={restaurantId}
              >
                Get directions <span aria-hidden="true">&rarr;</span>
              </TrackedRestaurantLink>
            ) : null}
          </div>

          <div className={styles.hoursCard}>
            <BusinessHours hours={hours} specialHours={specialHours} timezone={timezone} />
          </div>
        </div>
      </div>
    </section>
  );
}
