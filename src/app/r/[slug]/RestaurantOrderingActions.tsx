import styles from "./restaurant-ordering-actions.module.css";
import { RestaurantDeliveryTrigger } from "./RestaurantDeliveryChooser";
import TrackedRestaurantLink from "./TrackedRestaurantLink";

type OrderingActionTrackingEvent = "delivery_clicked" | "pickup_clicked";

type RestaurantOrderingLinkAction = {
  kind?: "link";
  description: string;
  href: string;
  label: string;
  external?: boolean;
  trackingEvent?: OrderingActionTrackingEvent;
};

type RestaurantOrderingDeliveryAction = {
  kind: "delivery";
  description: string;
  label: string;
};

export type RestaurantOrderingAction = RestaurantOrderingLinkAction | RestaurantOrderingDeliveryAction;

type RestaurantOrderingActionsProps = {
  actions: readonly RestaurantOrderingAction[];
  description?: string;
  eyebrow: string;
  restaurantId: string;
  title: string;
};

function OrderingActionLink({
  action,
  restaurantId,
}: {
  action: RestaurantOrderingAction;
  restaurantId: string;
}) {
  const content = (
    <>
      <span className={styles.actionLabel}>{action.label}</span>
      <span className={styles.actionDescription}>{action.description}</span>
      <span className={styles.actionArrow} aria-hidden="true">&rarr;</span>
    </>
  );

  if (action.kind === "delivery") {
    return (
      <RestaurantDeliveryTrigger className={styles.action}>
        {content}
      </RestaurantDeliveryTrigger>
    );
  }

  const externalProps = action.external
    ? { target: "_blank" as const, rel: "noreferrer" }
    : {};

  if (action.trackingEvent) {
    return (
      <TrackedRestaurantLink
        className={styles.action}
        eventName={action.trackingEvent}
        href={action.href}
        restaurantId={restaurantId}
        {...externalProps}
      >
        {content}
      </TrackedRestaurantLink>
    );
  }

  return (
    <a className={styles.action} href={action.href} {...externalProps}>
      {content}
    </a>
  );
}

export default function RestaurantOrderingActions({
  actions,
  description,
  eyebrow,
  restaurantId,
  title,
}: RestaurantOrderingActionsProps) {
  if (actions.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="restaurant-ordering-title">
      <div className={styles.inner}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="restaurant-ordering-title">{title}</h2>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <div className={styles.actions}>
          {actions.map((action) => (
            <OrderingActionLink
              key={`${action.label}:${action.kind === "delivery" ? "delivery" : action.href}`}
              action={action}
              restaurantId={restaurantId}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
