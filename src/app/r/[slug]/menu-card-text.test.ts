import assert from "node:assert/strict";
import test from "node:test";
import { descriptionLineBudget } from "./menu-card-text";

test("long card titles borrow description space before exceeding the shared text budget", () => {
  assert.deepEqual([1, 2, 3, 4, 8].map((lines) => descriptionLineBudget(lines, false)), [3, 2, 1, 0, 0]);
  assert.deepEqual([1, 2, 3, 4, 8].map((lines) => descriptionLineBudget(lines, true)), [2, 1, 0, 0, 0]);
  assert.equal(descriptionLineBudget(2.1, true), 0);
});
