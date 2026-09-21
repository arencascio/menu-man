import TrackedRestaurantLink, { type RestaurantLinkEvent } from "./TrackedRestaurantLink";
import { RestaurantDeliveryTrigger } from "./RestaurantDeliveryChooser";
import styles from "./restaurant-footer.module.css";

type RestaurantFooterDestinationLink = {
  kind?: "link";
  external?: boolean;
  href: string;
  label: string;
  trackingEvent?: RestaurantLinkEvent;
};

type RestaurantFooterDeliveryLink = {
  kind: "delivery";
  label: string;
};

export type RestaurantFooterLink = RestaurantFooterDestinationLink | RestaurantFooterDeliveryLink;

type RestaurantFooterProps = {
  address?: string | null;
  homeHref: string;
  links: readonly RestaurantFooterLink[];
  logoUrl: string | null;
  name: string;
  restaurantId: string;
};

export default function RestaurantFooter({
  address,
  homeHref,
  links,
  logoUrl,
  name,
  restaurantId,
}: RestaurantFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="restaurant-footer" className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.identity}>
          <a className={styles.brand} href={homeHref} aria-label={`${name} home`}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.logo} src={logoUrl} alt="" />
            ) : (
              <span className={styles.brandMark} aria-hidden="true">{name.charAt(0)}</span>
            )}
            <span>{name}</span>
          </a>
          {address ? <p className={styles.address}>{address}</p> : null}
        </div>

        {links.length > 0 ? (
          <nav className={styles.links} aria-label={`${name} footer`}>
            {links.map((link) => (
              link.kind === "delivery" ? (
                <RestaurantDeliveryTrigger
                  className={styles.link}
                  key={`${link.label}:delivery`}
                >
                  {link.label}
                </RestaurantDeliveryTrigger>
              ) : link.trackingEvent ? (
                <TrackedRestaurantLink
                  className={styles.link}
                  eventName={link.trackingEvent}
                  href={link.href}
                  key={`${link.label}:${link.href}`}
                  rel={link.external ? "noreferrer" : undefined}
                  restaurantId={restaurantId}
                  target={link.external ? "_blank" : undefined}
                >
                  {link.label}
                </TrackedRestaurantLink>
              ) : (
                <a
                  className={styles.link}
                  href={link.href}
                  key={`${link.label}:${link.href}`}
                  rel={link.external ? "noreferrer" : undefined}
                  target={link.external ? "_blank" : undefined}
                >
                  {link.label}
                </a>
              )
            ))}
          </nav>
        ) : null}

        <p className={styles.copyright}>&copy; {currentYear} {name}</p>
      </div>
    </footer>
  );
}
