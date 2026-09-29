"use client";

import { useEffect, useRef, useState } from "react";
import type { PickupAvailability } from "@/lib/checkout/contracts";
import { RestaurantDeliveryTrigger } from "./RestaurantDeliveryChooser";
import RestaurantPickupTimeChooser from "./RestaurantPickupTimeChooser";
import { getOrderingStatus } from "./ordering-status";
import type { PickupChooserMode } from "./pickup-time-chooser";
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
  const [chooser, setChooser] = useState<{ mode: PickupChooserMode; opener: HTMLButtonElement } | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

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
  const canSchedulePickup = Boolean(!canOrderPickup && availability?.scheduled.enabled && availability.scheduled.slots.length);

  function openPickupChooser(mode: PickupChooserMode, opener: HTMLButtonElement) {
    setChooser({ mode, opener });
  }

  return (
    <aside className={styles.panel} aria-label="Ordering status" ref={panelRef} tabIndex={-1}>
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
          {canOrderPickup ? <button className={styles.orderPickup} type="button" aria-haspopup="dialog" onClick={(event) => openPickupChooser("order", event.currentTarget)}>Order Pickup</button> : null}
          {canSchedulePickup ? <button className={styles.schedulePickup} type="button" aria-haspopup="dialog" onClick={(event) => openPickupChooser("schedule", event.currentTarget)}>Schedule Pickup</button> : null}
          {hasDelivery ? <RestaurantDeliveryTrigger className={styles.delivery}>Delivery <span aria-hidden="true">→</span></RestaurantDeliveryTrigger> : null}
        </div>
      ) : null}
      {chooser && <RestaurantPickupTimeChooser
        mode={chooser.mode}
        onAvailabilityChange={setAvailability}
        onClose={() => {
          (chooser.opener.isConnected ? chooser.opener : panelRef.current)?.focus({ preventScroll: true });
          setChooser(null);
        }}
        restaurantId={restaurantId}
        restaurantSlug={restaurantSlug}
      />}
    </aside>
  );
}
