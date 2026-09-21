import styles from "./restaurant-page.module.css";
import { RestaurantDeliveryTrigger } from "./RestaurantDeliveryChooser";
import TrackedRestaurantLink from "./TrackedRestaurantLink";

type RestaurantHeroTrackingEvent = "delivery_clicked" | "pickup_clicked";

type RestaurantHeroLinkAction = {
  kind?: "link";
  href: string;
  label: string;
  external?: boolean;
  trackingEvent?: RestaurantHeroTrackingEvent;
};

type RestaurantHeroDeliveryAction = {
  kind: "delivery";
  label: string;
};

export type RestaurantHeroAction = RestaurantHeroLinkAction | RestaurantHeroDeliveryAction;

export type RestaurantHeroPresentation = {
  layout: "photo-split";
  eyebrow: string;
  headline: string;
  supportingText?: string;
  imageAlt: string;
  primaryAction: RestaurantHeroAction;
  secondaryAction?: RestaurantHeroAction;
};

type RestaurantHeroProps = {
  restaurantId: string;
  name: string;
  logoUrl: string | null;
  imageUrl: string | null;
  presentation: RestaurantHeroPresentation;
};

function HeroAction({ action, className, restaurantId }: {
  action: RestaurantHeroAction;
  className: string;
  restaurantId: string;
}) {
  if (action.kind === "delivery") {
    return (
      <RestaurantDeliveryTrigger className={className}>
        {action.label}
      </RestaurantDeliveryTrigger>
    );
  }

  const externalProps = action.external
    ? { target: "_blank" as const, rel: "noreferrer" }
    : {};

  if (action.trackingEvent) {
    return (
      <TrackedRestaurantLink
        className={className}
        href={action.href}
        eventName={action.trackingEvent}
        restaurantId={restaurantId}
        {...externalProps}
      >
        {action.label}
      </TrackedRestaurantLink>
    );
  }

  return (
    <a className={className} href={action.href} {...externalProps}>
      {action.label}
    </a>
  );
}

export default function RestaurantHero({
  restaurantId,
  name,
  logoUrl,
  imageUrl,
  presentation,
}: RestaurantHeroProps) {
  return (
    <section
      className={styles.hero}
      data-layout={presentation.layout}
      aria-labelledby="restaurant-page-title"
    >
      <div className={styles.heroContent}>
        {logoUrl ? (
          // Restaurant logos may be hosted by each restaurant's configured asset provider.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.heroLogo} src={logoUrl} alt={`${name} logo`} />
        ) : null}
        <p className={styles.eyebrow}>{presentation.eyebrow}</p>
        <h1 id="restaurant-page-title">{presentation.headline}</h1>
        {presentation.supportingText ? (
          <p className={styles.tagline}>{presentation.supportingText}</p>
        ) : null}
        <div className={styles.heroActions}>
          <HeroAction
            action={presentation.primaryAction}
            className={styles.primaryAction}
            restaurantId={restaurantId}
          />
          {presentation.secondaryAction ? (
            <HeroAction
              action={presentation.secondaryAction}
              className={styles.secondaryAction}
              restaurantId={restaurantId}
            />
          ) : null}
        </div>
      </div>

      <div className={styles.heroMedia}>
        {imageUrl ? (
          // Menu and restaurant images may be hosted by configured external providers.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.heroImage} src={imageUrl} alt={presentation.imageAlt} />
        ) : (
          <div className={styles.heroImagePlaceholder} aria-hidden="true" />
        )}
      </div>
    </section>
  );
}
