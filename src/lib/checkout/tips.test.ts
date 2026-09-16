import assert from "node:assert/strict";
import test from "node:test";
import {
  maximumCustomTipCents,
  parseCustomTipCents,
  reconcileLargeTipConfirmation,
  requiresLargeTipConfirmation,
} from "./tips";

test("custom tip input converts dollars to exact integer cents", () => {
  assert.equal(parseCustomTipCents("4.25"), 425);
  assert.equal(parseCustomTipCents("4.2"), 420);
  assert.equal(parseCustomTipCents(".50"), 50);
  assert.equal(parseCustomTipCents("0"), 0);
});

test("custom tip input rejects fractional cents, negative, blank, and unsupported integers", () => {
  assert.equal(parseCustomTipCents("500.01"), 50_001);
  for (const value of ["", "-1", "1.001", "abc", "21474836.48"]) {
    assert.equal(parseCustomTipCents(value), null);
  }
});

test("custom tip equal to subtotal does not require confirmation; greater does", () => {
  assert.equal(requiresLargeTipConfirmation("custom", 3_000, 3_000), false);
  assert.equal(requiresLargeTipConfirmation("custom", 3_001, 3_000), true);
  assert.equal(requiresLargeTipConfirmation("20_percent", 4_500, 3_000), false);
});

test("large-tip confirmation resets when tip or subtotal changes", () => {
  const confirmation = { tipCents: 4_500, subtotalCents: 3_000, cartSubtotalCents: 3_000 };
  assert.deepEqual(
    reconcileLargeTipConfirmation(confirmation, "custom", 4_500, 3_000),
    confirmation,
  );
  assert.equal(reconcileLargeTipConfirmation(confirmation, "custom", 4_400, 3_000), null);
  assert.equal(reconcileLargeTipConfirmation(confirmation, "custom", 4_500, 3_100), null);
  assert.equal(reconcileLargeTipConfirmation(confirmation, "custom", 3_000, 3_000), null);
});

test("custom tip hard cap is subtotal plus $500", () => {
  assert.equal(maximumCustomTipCents(2_000), 52_000);
  assert.equal(maximumCustomTipCents(10_000), 60_000);
});
