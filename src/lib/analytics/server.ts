import "server-only";

import type { ServerPurchaseEvent } from "./server-types";

// Purchase events are created transactionally in public.analytics_outbox by a
// verified payment event. Provider delivery workers consume this server-only type.
export function parseServerPurchaseEvent(payload: unknown): ServerPurchaseEvent {
  const event = payload as ServerPurchaseEvent;
  if (event?.name !== "purchase" || !event.transactionId || !event.orderId) {
    throw new Error("Invalid server purchase event.");
  }
  return event;
}
