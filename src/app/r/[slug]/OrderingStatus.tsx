"use client";

import { useEffect, useState } from "react";
import type { PickupAvailability } from "@/lib/checkout/contracts";
import { RestaurantDeliveryTrigger } from "./RestaurantDeliveryChooser";
import { getOrderingStatus } from "./ordering-status";
import styles from "./ordering-status.module.css";

export default function OrderingStatus({
  hasDelivery,
  restaurantSlug,
}: {
  hasDelivery: boolean;
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
      {hasDelivery ? (
        <RestaurantDeliveryTrigger className={styles.delivery}>Delivery <span aria-hidden="true">→</span></RestaurantDeliveryTrigger>
      ) : null}
    </aside>
  );
}
