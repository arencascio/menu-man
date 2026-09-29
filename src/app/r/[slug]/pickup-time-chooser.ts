import type { PickupAvailability } from "@/lib/checkout/contracts";
import { isPickupSelectionAvailable, type PickupSelection } from "@/lib/checkout/pickup-selection";

export type PickupChooserMode = "order" | "schedule";

export function initialChooserSelection(mode: PickupChooserMode, availability: PickupAvailability): PickupSelection | null {
  return mode === "order" && availability.asap.available ? { mode: "asap" } : null;
}

export function isChooserSelectionAvailable(
  mode: PickupChooserMode,
  availability: PickupAvailability,
  selection: PickupSelection | null,
) {
  if (!selection || (mode === "schedule" && selection.mode === "asap")) return false;
  if (selection.mode === "scheduled" && !availability.scheduled.enabled) return false;
  return isPickupSelectionAvailable(availability, selection);
}

export function groupPickupSlots(availability: PickupAvailability) {
  type Slot = { pickupAt: string; label: string };
  const groups: Array<{ key: string; label: string; slots: Slot[] }> = [];
  if (!availability.scheduled.enabled) return groups;

  let dateFormatter: Intl.DateTimeFormat | null = null;
  let dayKeyFormatter: Intl.DateTimeFormat | null = null;
  let timeFormatter: Intl.DateTimeFormat | null = null;
  if (availability.timezone) {
    try {
      const timeZone = availability.timezone;
      dateFormatter = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "short", day: "numeric", year: "numeric" });
      dayKeyFormatter = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
      timeFormatter = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    } catch {
      // The server's slot label remains usable if the timezone is unavailable.
    }
  }

  for (const slot of availability.scheduled.slots) {
    const date = new Date(slot.pickupAt);
    const key = dayKeyFormatter?.format(date) ?? slot.pickupAt.slice(0, 10);
    const label = dateFormatter?.format(date) ?? key;
    let group = groups[groups.length - 1];
    if (group?.key !== key) {
      group = { key, label, slots: [] };
      groups.push(group);
    }
    group.slots.push({ pickupAt: slot.pickupAt, label: timeFormatter?.format(date) ?? slot.label });
  }
  return groups;
}
