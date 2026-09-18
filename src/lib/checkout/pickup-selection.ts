import type { PickupAvailability } from "./contracts";

export type PickupSelection =
  | { mode: "asap" }
  | { mode: "scheduled"; pickupAt: string };

export function isPickupSelectionAvailable(
  availability: PickupAvailability | null,
  selection: PickupSelection,
) {
  if (!availability) return false;
  if (selection.mode === "asap") return availability.asap.available;
  return availability.scheduled.slots.some((slot) => slot.pickupAt === selection.pickupAt);
}

export function resolvePickupSelection(
  availability: PickupAvailability,
  current?: PickupSelection,
): PickupSelection | null {
  if (current && isPickupSelectionAvailable(availability, current)) return current;
  if (availability.asap.available) return { mode: "asap" };
  return null;
}
