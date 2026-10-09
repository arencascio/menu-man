import TrackedRestaurantLink from "./TrackedRestaurantLink";
import RestaurantContactIcon from "./RestaurantContactIcon";
import RestaurantFooterArtwork from "./RestaurantFooterArtwork";
import styles from "./restaurant-footer.module.css";

type RestaurantFooterProps = {
  address?: string | null;
  directionsUrl?: string | null;
  homeHref: string;
  logoUrl: string | null;
  artworkMark?: boolean;
  name: string;
  phone?: string | null;
  restaurantId: string;
};

export default function RestaurantFooter({
  address,
  directionsUrl,
  homeHref,
  logoUrl,
  artworkMark,
  name,
  phone,
  restaurantId,
}: RestaurantFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="restaurant-footer" className={styles.footer}>
      <div className={styles.inner}>
        {artworkMark && logoUrl ? (
          <div className={styles.artworkArea} aria-hidden="true">
            <RestaurantFooterArtwork src={logoUrl} />
          </div>
        ) : null}

        <div className={styles.identity}>
          <a className={styles.brand} href={homeHref} aria-label={`${name} home`}>
            {!artworkMark && logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.logo} src={logoUrl} alt="" />
            ) : !artworkMark ? (
              <span className={styles.brandMark} aria-hidden="true">{name.charAt(0)}</span>
            ) : null}
            <span>{name}</span>
          </a>

          {address ? (
            directionsUrl ? (
              <TrackedRestaurantLink
                className={styles.contactLink}
                eventName="directions_clicked"
                href={directionsUrl}
                restaurantId={restaurantId}
                rel="noreferrer"
                target="_blank"
              >
                <RestaurantContactIcon kind="directions" className={styles.contactIcon} />
                <span>{address}</span>
              </TrackedRestaurantLink>
            ) : <p className={styles.contactText}>{address}</p>
          ) : null}
          {phone ? (
            <TrackedRestaurantLink
              className={styles.contactLink}
              eventName="phone_clicked"
              href={`tel:${phone}`}
              restaurantId={restaurantId}
            >
              <RestaurantContactIcon kind="phone" className={styles.contactIcon} />
              <span>{phone}</span>
            </TrackedRestaurantLink>
          ) : null}
        </div>

        {directionsUrl || phone ? (
          <div className={styles.actions} role="group" aria-label={`${name} contact actions`}>
            {directionsUrl ? (
              <TrackedRestaurantLink
                className={styles.action}
                eventName="directions_clicked"
                href={directionsUrl}
                restaurantId={restaurantId}
                rel="noreferrer"
                target="_blank"
              >
                <RestaurantContactIcon kind="directions" />
                Directions
              </TrackedRestaurantLink>
            ) : null}
            {phone ? (
              <TrackedRestaurantLink
                className={styles.action}
                eventName="phone_clicked"
                href={`tel:${phone}`}
                restaurantId={restaurantId}
              >
                <RestaurantContactIcon kind="phone" />
                Call Us
              </TrackedRestaurantLink>
            ) : null}
          </div>
        ) : null}

        <p className={styles.copyright}>&copy; {currentYear} {name}</p>
      </div>
    </footer>
  );
}
