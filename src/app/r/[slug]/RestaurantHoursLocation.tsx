import { isDemoRestaurant } from "@/lib/demo/policy";
import RestaurantDemoContact from "./RestaurantDemoContact";
import BusinessHours, { type BusinessHour, type SpecialHour } from "./BusinessHours";
import styles from "./restaurant-hours-location.module.css";
import TrackedRestaurantLink from "./TrackedRestaurantLink";

type RestaurantHoursLocationProps = {
  addressLine1: string | null;
  city: string | null;
  description?: string | null;
  density?: "comfortable" | "compact";
  eyebrow?: string;
  heading?: string;
  unavailableLocationMessage?: string;
  directionsUrl: string | null;
  hours: readonly BusinessHour[];
  phone: string | null;
  phoneIsIllustrative?: boolean;
  postalCode: string | null;
  restaurantId: string;
  restaurantName: string;
  showHeading?: boolean;
  specialHours: readonly SpecialHour[];
  state: string | null;
  timezone: string | null;
  variant?: "editorial";
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
  heading,
  unavailableLocationMessage = "Location details have not been published yet.",
  directionsUrl,
  hours,
  phone,
  phoneIsIllustrative = false,
  postalCode,
  restaurantId,
  restaurantName,
  showHeading = true,
  specialHours,
  state,
  timezone,
  variant,
}: RestaurantHoursLocationProps) {
  const illustrative = isDemoRestaurant(restaurantId);
  const addressParts = [addressLine1, city, state, postalCode].filter(isUsableValue);
  const hasAddress = addressParts.length > 0;
  const usableDescription = isUsableValue(description) ? description : null;

  return (
    <section
      id="restaurant-information"
      className={`${styles.section} ${density === "compact" ? styles.compact : ""}`}
      data-variant={variant}
      aria-labelledby={showHeading ? "restaurant-information-title" : undefined}
      aria-label={showHeading ? undefined : "Hours and location"}
    >
      <div className={styles.inner}>
        {showHeading ? <div className={styles.heading}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h2 id="restaurant-information-title">{heading ?? `Visit ${restaurantName}`}</h2>
          {usableDescription ? <p className={styles.description}>{usableDescription}</p> : null}
        </div> : null}

        <div className={styles.grid}>
          <div className={styles.locationCard}>
            {variant === "editorial" ? <p className={styles.cardLabel}>{hasAddress ? "Find us" : "Location"}</p> : null}
            {hasAddress ? (
              <address className={styles.address}>{illustrative ? <RestaurantDemoContact kind="address">{addressParts.join(", ")}</RestaurantDemoContact> : addressParts.join(", ")}</address>
            ) : (
              <p className={styles.unavailable}>{unavailableLocationMessage}</p>
            )}

            {phone ? (
              <div className={styles.contact}>
                <span>{"Call us"}</span>
                {illustrative ? <RestaurantDemoContact kind="phone">{phone}</RestaurantDemoContact> : phoneIsIllustrative ? <span>{phone}</span> : <TrackedRestaurantLink surface="restaurant_information"
                  href={`tel:${phone}`}
                  eventName="phone_clicked"
                  restaurantId={restaurantId}
                >
                  {phone}
                </TrackedRestaurantLink>}
              </div>
            ) : null}

            {directionsUrl && !illustrative ? (
              <TrackedRestaurantLink surface="restaurant_information"
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
