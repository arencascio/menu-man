import BusinessHours, { type BusinessHour, type SpecialHour } from "./BusinessHours";
import styles from "./restaurant-hours-location.module.css";
import TrackedRestaurantLink from "./TrackedRestaurantLink";

type RestaurantHoursLocationProps = {
  addressLine1: string | null;
  city: string | null;
  description?: string | null;
  density?: "comfortable" | "compact";
  eyebrow?: string;
  directionsUrl: string | null;
  hours: readonly BusinessHour[];
  phone: string | null;
  postalCode: string | null;
  restaurantId: string;
  restaurantName: string;
  showHeading?: boolean;
  specialHours: readonly SpecialHour[];
  state: string | null;
  timezone: string | null;
};

function isUsableValue(value: string | null | undefined) {
  return Boolean(value && !value.includes("PLACEHOLDER"));
}

export default function RestaurantHoursLocation({
  addressLine1,
  city,
  description,
  density = "comfortable",
  eyebrow,
  directionsUrl,
  hours,
  phone,
  postalCode,
  restaurantId,
  restaurantName,
  showHeading = true,
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
      className={`${styles.section} ${density === "compact" ? styles.compact : ""}`}
      aria-labelledby={showHeading ? "restaurant-information-title" : undefined}
      aria-label={showHeading ? undefined : "Hours and location"}
    >
      <div className={styles.inner}>
        {showHeading ? <div className={styles.heading}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h2 id="restaurant-information-title">Visit {restaurantName}</h2>
          {usableDescription ? <p className={styles.description}>{usableDescription}</p> : null}
        </div> : null}

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
