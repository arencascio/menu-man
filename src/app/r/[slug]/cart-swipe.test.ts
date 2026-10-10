import assert from "node:assert/strict";
import test from "node:test";
import { getCartSwipeAction, getCartSwipeAxis } from "./cart-swipe";

test("cart swipe ignores tap jitter and favors vertical scrolling over diagonal movement", () => {
  assert.equal(getCartSwipeAxis(6, 8), "pending");
  assert.equal(getCartSwipeAxis(15, 80), "vertical");
  assert.equal(getCartSwipeAxis(50, 45), "vertical");
  assert.equal(getCartSwipeAxis(-60, 10), "horizontal");
  assert.equal(getCartSwipeAxis(60, -10), "horizontal");
});

test("cart swipes below the commitment threshold reveal nothing; committed swipes select an action only", () => {
  assert.equal(getCartSwipeAction(-47), null);
  assert.equal(getCartSwipeAction(47), null);
  assert.equal(getCartSwipeAction(-48), "remove");
  assert.equal(getCartSwipeAction(48), "edit");
  assert.equal(getCartSwipeAction(0), null);
});
