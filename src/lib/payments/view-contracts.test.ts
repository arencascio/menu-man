import assert from "node:assert/strict";
import test from "node:test";
import { orderPaymentViewSchema } from "./view-contracts";

test("order payment view accepts frozen snapshots without diner identity", () => {
  const parsed = orderPaymentViewSchema.safeParse({
    order: {
      orderId: "10000000-0000-4000-8000-000000000001",
      orderNumber: "1001",
      orderStatus: "pending_payment",
      paymentStatus: "pending",
      currency: "USD",
      subtotalCents: 1000,
      taxCents: 80,
      tipCents: 170,
      totalCents: 1250,
      pickup: { mode: "asap", pickupAt: "2026-09-11T20:00:00.000Z", timezone: "America/Los_Angeles" },
      items: [{
        orderItemId: "20000000-0000-4000-8000-000000000001",
        menuItemId: "30000000-0000-4000-8000-000000000001",
        itemName: "Taco",
        quantity: 1,
        unitPriceCents: 1000,
        lineTotalCents: 1000,
        specialInstructions: null,
        modifiers: [],
      }],
      replayed: false,
      cancellationReason: null,
    },
    payment: {
      paymentId: "40000000-0000-4000-8000-000000000001",
      orderId: "10000000-0000-4000-8000-000000000001",
      connectionId: "50000000-0000-4000-8000-000000000001",
      provider: "fake",
      providerEnvironment: "test",
      status: "processing",
      orderStatus: "pending_payment",
      paymentStatus: "pending",
      captureMode: "automatic",
      amountCents: 1250,
      currency: "USD",
      paymentDueAt: "2026-09-11T20:30:00.000Z",
      paidAt: null,
      latestAttempt: null,
    },
  });
  assert.equal(parsed.success, true);
});
