import assert from "node:assert/strict";
import test from "node:test";
import { checkoutResponseSchema, type AuthoritativeOrderResponse } from "./contracts";
import { existingCheckoutDetailsPath, existingCheckoutMessage, resolveCheckoutResponse } from "./replay";

const order: AuthoritativeOrderResponse = {
  orderId: "50000000-0000-4000-8000-000000000001",
  orderNumber: "1001",
  orderStatus: "pending_payment",
  paymentStatus: "unpaid",
  currency: "USD",
  subtotalCents: 1000,
  taxCents: 100,
  tipCents: 0,
  totalCents: 1100,
  pickup: { mode: "asap", pickupAt: "2026-10-01T19:00:00.000Z", timezone: "America/Los_Angeles" },
  items: [{
    menuItemId: "50000000-0000-4000-8000-000000000002",
    itemName: "Taco",
    quantity: 1,
    unitPriceCents: 1000,
    lineTotalCents: 1000,
  }],
  replayed: false,
};

const prepared = {
  checkoutToken: "x".repeat(43),
  expiresAt: "2026-10-01T20:00:00.000Z",
  payment: {
    paymentId: "50000000-0000-4000-8000-000000000003",
    orderId: order.orderId,
    connectionId: "50000000-0000-4000-8000-000000000004",
    provider: "fake",
    providerEnvironment: "test" as const,
    status: "requires_payment_method" as const,
    orderStatus: "pending_payment" as const,
    paymentStatus: "unpaid" as const,
    captureMode: "automatic" as const,
    amountCents: 1100,
    currency: "USD",
    paymentDueAt: "2026-10-01T19:30:00.000Z",
    paidAt: null,
    latestAttempt: null,
  },
  browserSession: { mode: "embedded" as const, provider: "fake", publicConfig: {} },
};

test("new and immediate exact replay prepare the same order without creating another order", async () => {
  for (const replayed of [false, true]) {
    let preparationCount = 0;
    const resolved = await resolveCheckoutResponse({ ...order, replayed }, {
      canViewExistingOrder: async () => { throw new Error("Unexpected existing-order authorization"); },
      preparePayment: async (orderId) => {
        assert.equal(orderId, order.orderId);
        preparationCount++;
        return prepared;
      },
    });
    assert.equal(preparationCount, 1);
    assert.equal(resolved.response.kind, "payable");
    assert.equal(resolved.response.orderId, order.orderId);
    assert.equal(resolved.capability?.checkoutToken, prepared.checkoutToken);
    assert.equal(checkoutResponseSchema.safeParse(resolved.response).success, true);
    assert.equal(JSON.stringify(resolved.response).includes(prepared.checkoutToken), false);
  }
});

test("progressed exact replays never prepare payment or expose order details without a capability", async () => {
  for (const [orderStatus, paymentStatus] of [
    ["cancelled", "failed"], ["placed", "paid"],
    ["cancelled", "refunded"], ["placed", "partially_refunded"],
  ] as const) {
    for (const hasGuestCapability of [false, true]) {
      const resolved = await resolveCheckoutResponse({ ...order, orderStatus, paymentStatus, replayed: true }, {
        canViewExistingOrder: async () => hasGuestCapability,
        preparePayment: async () => { throw new Error("Progressed order reopened payment"); },
      });
      assert.equal(resolved.response.kind, "existing");
      assert.equal(resolved.response.orderId, hasGuestCapability ? order.orderId : null);
      assert.equal(resolved.capability, null);
      assert.equal(checkoutResponseSchema.safeParse(resolved.response).success, true);
      assert.equal(existingCheckoutDetailsPath("armandos", resolved.response), hasGuestCapability
        ? `/r/armandos/order/${order.orderId}/payment?view=details`
        : null);
      assert.equal("items" in resolved.response, false);
      assert.equal("totalCents" in resolved.response, false);
      assert.equal("paymentSession" in resolved.response, false);
      assert.notEqual(existingCheckoutMessage(resolved.response), "");
    }
  }
});
