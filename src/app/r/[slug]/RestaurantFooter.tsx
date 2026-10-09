import TrackedRestaurantLink from "./TrackedRestaurantLink";
import RestaurantContactIcon from "./RestaurantContactIcon";
import RestaurantFooterArtwork from "./RestaurantFooterArtwork";
import styles from "./restaurant-footer.module.css";
import Link from "next/link";
import { RestaurantDeliveryTrigger } from "./RestaurantDeliveryChooser";
import type { RestaurantNavigationItem } from "./RestaurantNavigation";
import RestaurantNavigationIcon from "./RestaurantNavigationIcon";

type RestaurantFooterProps = {
  className?: string;
  address?: string | null;
  directionsUrl?: string | null;
  homeHref: string;
  logoUrl: string | null;
  artworkMark?: boolean;
  name: string;
  phone?: string | null;
  restaurantId: string;
  navigation: readonly RestaurantNavigationItem[];
};

export default function RestaurantFooter({
  className,
  address,
  directionsUrl,
  homeHref,
  logoUrl,
  artworkMark,
  name,
  phone,
  restaurantId,
  navigation,
}: RestaurantFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="restaurant-footer" className={[styles.footer, className].filter(Boolean).join(" ")}>
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

        <nav className={styles.actions} aria-label={`${name} footer navigation`}>
          {navigation.map((item) => (
            item.kind === "delivery" ? (
              <RestaurantDeliveryTrigger className={styles.action} key={`${item.label}:delivery`}>
                {item.icon ? <RestaurantNavigationIcon icon={item.icon} /> : null}
                {item.label}
              </RestaurantDeliveryTrigger>
            ) : item.icon === "phone" || item.icon === "directions" || item.icon === "navigation" ? (
              <TrackedRestaurantLink
                key={`${item.label}:${item.href}`}
                className={styles.action}
                eventName={item.icon === "phone" ? "phone_clicked" : "directions_clicked"}
                href={item.href}
                restaurantId={restaurantId}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
              >
                <RestaurantNavigationIcon icon={item.icon} />
                {item.label}
              </TrackedRestaurantLink>
            ) : (
              <Link className={styles.action} key={`${item.label}:${item.href}`} href={item.href}
                target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined}>
                {item.icon ? <RestaurantNavigationIcon icon={item.icon} /> : null}
                {item.label}
              </Link>
            )
          ))}
        </nav>

        <p className={styles.copyright}>&copy; {currentYear} {name}</p>
      </div>
    </footer>
  );
}
