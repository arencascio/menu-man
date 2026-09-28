"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics/client";
import type { PickupAvailability } from "@/lib/checkout/contracts";
import { pickupIntentEvent, savePickupIntent, type PickupIntent } from "@/lib/checkout/pickup-intent";
import { RestaurantDeliveryTrigger } from "./RestaurantDeliveryChooser";
import { getOrderingStatus } from "./ordering-status";
import styles from "./ordering-status.module.css";

export default function OrderingStatus({
  hasDelivery,
  restaurantId,
  restaurantSlug,
}: {
  hasDelivery: boolean;
  restaurantId: string;
  restaurantSlug: string;
}) {
  const [availability, setAvailability] = useState<PickupAvailability | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`/api/restaurants/${encodeURIComponent(restaurantSlug)}/pickup-availability`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Pickup availability could not be loaded.");
        return response.json() as Promise<PickupAvailability>;
      })
      .then((nextAvailability) => {
        setAvailability(nextAvailability);
        setLoadFailed(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadFailed(true);
      });

    return () => controller.abort();
  }, [restaurantSlug]);

  const status = availability ? getOrderingStatus(availability) : null;
  const canOrderPickup = Boolean(availability?.asap.available);
  const canSchedulePickup = Boolean(availability?.scheduled.enabled && availability.scheduled.slots.length);

  function startPickup(intent: PickupIntent) {
    try {
      savePickupIntent(window.sessionStorage, restaurantId, intent);
    } catch {
      // The cart can still open; checkout will use its standard availability default.
    }
    trackEvent({ name: "pickup_clicked", restaurantId });
    window.dispatchEvent(new CustomEvent(pickupIntentEvent, { detail: restaurantId }));
  }

  return (
    <aside className={styles.panel} aria-label="Ordering status">
      <div className={styles.pickup} aria-live="polite">
        <span className={`${styles.indicator} ${status ? styles[status.state] : ""}`} aria-hidden="true" />
        <div>
          <p className={styles.eyebrow}>Pickup</p>
          <strong>{status?.title ?? (loadFailed ? "Pickup status is unavailable" : "Checking pickup availability")}</strong>
          <p className={styles.detail}>{status?.detail ?? (loadFailed ? "Please check again shortly." : "")}</p>
        </div>
      </div>
      {(canOrderPickup || canSchedulePickup || hasDelivery) ? (
        <div className={styles.actions}>
          {canOrderPickup ? <button className={styles.orderPickup} type="button" onClick={() => startPickup({ mode: "asap" })}>Order Pickup</button> : null}
          {canSchedulePickup ? <button className={styles.schedulePickup} type="button" onClick={() => startPickup({ mode: "scheduled" })}>Schedule Pickup</button> : null}
          {hasDelivery ? <RestaurantDeliveryTrigger className={styles.delivery}>Delivery <span aria-hidden="true">→</span></RestaurantDeliveryTrigger> : null}
        </div>
      ) : null}
    </aside>
  );
}
