import assert from "node:assert/strict";
import test from "node:test";
import { reviewSlot, type ReviewPosition } from "./review-position";

test("persistent review slides move exactly one slot at every endpoint including wrap", () => {
  for (const count of [3, 14]) for (let previous = 0; previous < count; previous++) {
    for (const direction of [1, -1] as const) {
      const active = (previous + direction + count) % count;
      const position: ReviewPosition = { active, previous, direction, phase: "prepare" };
      const before = Array.from({ length: count }, (_, i) => reviewSlot(i, count, position));
      const during = before.map((_, i) => reviewSlot(i, count, { ...position, phase: "moving" }));
      assert.deepEqual(during, before.map(slot => slot - direction));
      assert.equal(reviewSlot(active, count, { ...position, phase: "rest" }), 0);
      // Only cards outside the visible count-1 slots can jump when settled.
      during.forEach((slot, i) => {
        if (slot >= 0 && slot < count - 1) assert.equal(reviewSlot(i, count, { ...position, phase: "rest" }), slot);
      });
    }
  }
});
