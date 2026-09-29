"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PickupAvailability } from "@/lib/checkout/contracts";
import type { PickupSelection } from "@/lib/checkout/pickup-selection";
import { pickupIntentEvent, readPickupIntent, type PickupIntent } from "@/lib/checkout/pickup-intent";
import { RestaurantDeliveryTrigger } from "./RestaurantDeliveryChooser";
import RestaurantPickupTimeChooser from "./RestaurantPickupTimeChooser";
import { formatPickupTime, formatScheduledPickup, getDisplayedPickupIntent, getOrderingStatus } from "./ordering-status";
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
  const [pickupIntent, setPickupIntent] = useState<PickupSelection | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [chooser, setChooser] = useState<{ mode: PickupChooserMode; opener: HTMLButtonElement } | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const availabilityRef = useRef<PickupAvailability | null>(null);

  const updateAvailability = useCallback((nextAvailability: PickupAvailability) => {
    availabilityRef.current = nextAvailability;
    setAvailability(nextAvailability);
    let savedIntent: PickupIntent | null = null;
    try {
      savedIntent = readPickupIntent(window.sessionStorage, restaurantId);
    } catch {
      // Session storage can be unavailable; the checkout flow remains authoritative.
    }
    setPickupIntent(getDisplayedPickupIntent(nextAvailability, savedIntent));
  }, [restaurantId]);

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
        updateAvailability(nextAvailability);
        setLoadFailed(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadFailed(true);
      });

    return () => controller.abort();
  }, [restaurantSlug, updateAvailability]);

  useEffect(() => {
    const handlePickupIntent = (event: Event) => {
      if ((event as CustomEvent<unknown>).detail !== restaurantId) return;
      const currentAvailability = availabilityRef.current;
      if (!currentAvailability) return;
      try {
        setPickupIntent(getDisplayedPickupIntent(currentAvailability, readPickupIntent(window.sessionStorage, restaurantId)));
      } catch {
        setPickupIntent(null);
      }
    };
    window.addEventListener(pickupIntentEvent, handlePickupIntent);
    return () => window.removeEventListener(pickupIntentEvent, handlePickupIntent);
  }, [restaurantId]);

  const status = availability ? getOrderingStatus(availability) : null;
  const canOrderPickup = Boolean(availability?.asap.available);
  const canSchedulePickup = Boolean(!canOrderPickup && availability?.scheduled.enabled && availability.scheduled.slots.length);
  const scheduledDisplay = pickupIntent?.mode === "scheduled"
    ? formatScheduledPickup(pickupIntent.pickupAt, availability?.timezone ?? null)
    : null;
  const statusTitle = pickupIntent?.mode === "asap" ? "ASAP" : scheduledDisplay ? `Scheduled for ${scheduledDisplay.day}` : status?.title;
  const statusDetail = pickupIntent?.mode === "asap" && availability?.asap.estimatedPickupAt
    ? `Ready around ${formatPickupTime(availability.asap.estimatedPickupAt, availability.timezone)}`
    : scheduledDisplay
      ? scheduledDisplay.time
      : pickupIntent ? "Pickup available now" : status?.detail;

  function openPickupChooser(mode: PickupChooserMode, opener: HTMLButtonElement) {
    setChooser({ mode, opener });
  }

  const changePickupMode: PickupChooserMode = canOrderPickup ? "order" : "schedule";
  const hasPickupAction = Boolean(pickupIntent || canOrderPickup || canSchedulePickup);

  return (
    <aside className={styles.panel} aria-label="Ordering status" ref={panelRef} tabIndex={-1}>
      <div className={styles.pickup} aria-live="polite">
        <span className={`${styles.indicator} ${status ? styles[status.state] : ""}`} aria-hidden="true" />
        <div>
          <p className={styles.eyebrow}>Pickup</p>
          <strong>{statusTitle ?? (loadFailed ? "Pickup status is unavailable" : "Checking pickup availability")}</strong>
          <p className={styles.detail}>{statusDetail ?? (loadFailed ? "Please check again shortly." : "")}</p>
        </div>
      </div>
      {(hasPickupAction || hasDelivery) ? (
        <div className={styles.actions}>
          {hasPickupAction ? <button className={pickupIntent ? styles.schedulePickup : styles.orderPickup} type="button" aria-haspopup="dialog" onClick={(event) => openPickupChooser(pickupIntent ? changePickupMode : canOrderPickup ? "order" : "schedule", event.currentTarget)}>{pickupIntent ? "Change Pickup Time" : canOrderPickup ? "Order Pickup" : "Schedule Pickup"}</button> : null}
          {hasDelivery ? <RestaurantDeliveryTrigger className={styles.delivery}>Delivery <span aria-hidden="true">→</span></RestaurantDeliveryTrigger> : null}
        </div>
      ) : null}
      {chooser && <RestaurantPickupTimeChooser
        initialSelection={pickupIntent}
        mode={chooser.mode}
        onAvailabilityChange={updateAvailability}
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
