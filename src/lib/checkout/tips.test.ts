import assert from "node:assert/strict";
import test from "node:test";
import { parseCustomTipCents } from "./tips";

test("custom tip input converts dollars to exact integer cents", () => {
  assert.equal(parseCustomTipCents("4.25"), 425);
  assert.equal(parseCustomTipCents("4.2"), 420);
  assert.equal(parseCustomTipCents(".50"), 50);
  assert.equal(parseCustomTipCents("0"), 0);
});

test("custom tip input rejects fractional cents, negative, blank, and amounts above $500", () => {
  for (const value of ["", "-1", "1.001", "abc", "500.01", "21474836.48"]) {
    assert.equal(parseCustomTipCents(value), null);
  }
});
