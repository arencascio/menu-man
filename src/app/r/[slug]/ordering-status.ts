import type { PickupAvailability } from "@/lib/checkout/contracts";

export type OrderingStatus = {
  detail: string;
  state: "available" | "closed" | "unavailable";
  title: string;
};

function formatPickupTime(pickupAt: string, timezone: string | null) {
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
