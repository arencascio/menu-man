import type { PickupAvailability } from "@/lib/checkout/contracts";
import { isPickupSelectionAvailable, type PickupSelection } from "@/lib/checkout/pickup-selection";
import type { PickupIntent } from "@/lib/checkout/pickup-intent";

export type OrderingStatus = {
  detail: string;
  state: "available" | "closed" | "unavailable";
  title: string;
};

export function formatPickupTime(pickupAt: string, timezone: string | null) {
  if (!timezone) return pickupAt;

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(pickupAt));
  } catch {
    return pickupAt;
  }
}

export function getDisplayedPickupIntent(
  availability: PickupAvailability,
  intent: PickupIntent | null,
): PickupSelection | null {
  if (!intent) return null;
  if (intent.mode === "asap") return isPickupSelectionAvailable(availability, intent) ? intent : null;
  if (!intent.pickupAt || !availability.scheduled.enabled) return null;
  const selection = { mode: "scheduled" as const, pickupAt: intent.pickupAt };
  return isPickupSelectionAvailable(availability, selection) ? selection : null;
}

export function formatScheduledPickup(pickupAt: string, timezone: string | null) {
  if (!timezone) return { day: pickupAt, time: "" };
  try {
    const date = new Date(pickupAt);
    const day = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric" }).format(date);
    const time = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(date);
    return { day, time };
  } catch {
    return { day: pickupAt, time: "" };
  }
}

export function getOrderingStatus(availability: PickupAvailability): OrderingStatus {
  const nextPickup = availability.scheduled.slots[0];

  if (availability.asap.available) {
    return {
      state: "available",
      title: "Ordering for pickup",
      detail: availability.asap.estimatedPickupAt
        ? `Pickup around ${formatPickupTime(availability.asap.estimatedPickupAt, availability.timezone)}`
        : "Pickup available now",
    };
  }

  if (nextPickup) {
    return {
      state: availability.currentlyOpen ? "available" : "closed",
      title: availability.currentlyOpen ? "Ordering for pickup" : "Pickup is currently closed",
      detail: `Next pickup: ${nextPickup.label}`,
    };
  }

  return {
    state: "unavailable",
    title: "Pickup is unavailable",
    detail: "No pickup times are currently available.",
  };
}
