import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutRequestSchema,
  checkoutResponseSchema,
  idempotencyKeySchema,
} from "./contracts";

const MENU_ID = "10000000-0000-4000-8000-000000000001";
const ITEM_A_ID = "20000000-0000-4000-8000-000000000001";
const ITEM_B_ID = "20000000-0000-4000-8000-000000000002";
const OPTION_A_ID = "30000000-0000-4000-8000-000000000001";
const OPTION_B_ID = "30000000-0000-4000-8000-000000000002";

function requestFixture() {
  return {
    menuId: MENU_ID.toUpperCase(),
    items: [
      {
        menuItemId: ITEM_B_ID,
        quantity: 2,
        modifierOptionIds: [OPTION_B_ID, OPTION_A_ID],
        specialInstructions: "  Cut in half  ",
      },
      {
        menuItemId: ITEM_A_ID,
        quantity: 1,
        modifierOptionIds: [],
        specialInstructions: "",
      },
    ],
    customer: {
      name: "  Ada Lovelace  ",
      phone: "  555-0100  ",
      email: "  ADA@EXAMPLE.COM  ",
    },
    pickup: {
      mode: "scheduled" as const,
      pickupAt: "2026-09-09T12:00:00-07:00",
    },
    tipChoice: "15_percent" as const,
    orderNotes: "  Ring bell  ",
  };
}

test("canonicalizes equivalent accepted checkout requests identically", () => {
  const first = checkoutRequestSchema.parse(requestFixture());
  const equivalent = requestFixture();
  equivalent.items.reverse();
  equivalent.items[0].specialInstructions = "   ";
  equivalent.items[1].modifierOptionIds.reverse();
  equivalent.customer.email = "ada@example.com";
  equivalent.pickup.pickupAt = "2026-09-09T19:00:00.000Z";

  const second = checkoutRequestSchema.parse(equivalent);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first.items[1].modifierOptionIds, [OPTION_A_ID, OPTION_B_ID]);
  assert.equal(first.customer.email, "ada@example.com");
  assert.equal(first.items[0].specialInstructions, null);
});

test("rejects client prices and duplicate modifier option IDs", () => {
  const withPrice = { ...requestFixture(), subtotalCents: 1 };
  assert.equal(checkoutRequestSchema.safeParse(withPrice).success, false);

  const duplicates = requestFixture();
  duplicates.items[0].modifierOptionIds = [OPTION_A_ID, OPTION_A_ID];
  assert.equal(checkoutRequestSchema.safeParse(duplicates).success, false);
});

test("requires UUID idempotency keys", () => {
  assert.equal(idempotencyKeySchema.safeParse("not-a-key").success, false);
  assert.equal(
    idempotencyKeySchema.parse("40000000-0000-4000-8000-000000000001"),
    "40000000-0000-4000-8000-000000000001",
  );
});

test("only accepts pre-payment order confirmation states", () => {
  const response = {
    orderId: "50000000-0000-4000-8000-000000000001",
    orderNumber: "1001",
    orderStatus: "pending_payment",
    paymentStatus: "unpaid",
    currency: "USD",
    subtotalCents: 1000,
    taxCents: 100,
    tipCents: 150,
    totalCents: 1250,
    pickup: {
      mode: "asap",
      pickupAt: "2026-09-09T19:00:00.000Z",
      timezone: "America/Los_Angeles",
    },
    items: [{
      menuItemId: ITEM_A_ID,
      itemName: "Taco",
      quantity: 1,
      unitPriceCents: 1000,
      lineTotalCents: 1000,
    }],
    replayed: false,
  };

  assert.equal(checkoutResponseSchema.safeParse(response).success, true);
  assert.equal(checkoutResponseSchema.safeParse({ ...response, orderStatus: "placed" }).success, false);
  assert.equal(checkoutResponseSchema.safeParse({ ...response, paymentStatus: "paid" }).success, false);
});
