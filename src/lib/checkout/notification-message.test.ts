import assert from "node:assert/strict";
import test from "node:test";
import { checkoutNotificationMessage } from "./notification-message";

test("checkout notification copy reflects enabled customer messages", () => {
  assert.equal(checkoutNotificationMessage({ orderConfirmationEnabled: true, readyForPickupEnabled: true }, " DINER@example.com "), "We'll send order confirmation and ready-for-pickup updates to diner@example.com.");
  assert.equal(checkoutNotificationMessage({ orderConfirmationEnabled: true, readyForPickupEnabled: false }, "diner@example.com"), "We'll send an order confirmation to diner@example.com.");
  assert.equal(checkoutNotificationMessage({ orderConfirmationEnabled: false, readyForPickupEnabled: true }, "diner@example.com"), "We'll send a ready-for-pickup update to diner@example.com.");
  assert.equal(checkoutNotificationMessage({ orderConfirmationEnabled: false, readyForPickupEnabled: false }, "diner@example.com"), null);
});

test("checkout notification copy invites an optional email without claiming delivery", () => {
  assert.equal(checkoutNotificationMessage({ orderConfirmationEnabled: true, readyForPickupEnabled: true }, ""), "Add an email to receive order confirmation and ready-for-pickup updates.");
  assert.equal(checkoutNotificationMessage({ orderConfirmationEnabled: false, readyForPickupEnabled: true }, null), "Add an email to receive a ready-for-pickup update.");
});

test("refund notification preferences cannot affect checkout promotional copy", () => {
  const preferences = { orderConfirmationEnabled: true, readyForPickupEnabled: false };
  assert.equal(checkoutNotificationMessage(preferences, "diner@example.com"), "We'll send an order confirmation to diner@example.com.");
  assert.doesNotMatch(checkoutNotificationMessage(preferences, "diner@example.com")!, /refund/i);
});
