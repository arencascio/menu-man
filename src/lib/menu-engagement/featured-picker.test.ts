import assert from "node:assert/strict";
import test from "node:test";
import { filterFeaturedItems, moveFeaturedItem, toggleFeaturedItem } from "./featured-picker";

test("Featured search and selection stay stable in a large menu", () => {
  const items = Array.from({ length: 350 }, (_, index) => ({ id: String(index), name: `Dish ${index}` }));
  let selected = toggleFeaturedItem([], "312");
  assert.deepEqual(filterFeaturedItems(items, " dish 312 ").map((item) => item.id), ["312"]);
  assert.deepEqual(filterFeaturedItems(items, "dish 9").map((item) => item.id).slice(0, 2), ["9", "90"]);
  assert.deepEqual(selected, ["312"]);
  selected = toggleFeaturedItem(selected, "9");
  assert.deepEqual(moveFeaturedItem(selected, 1, -1), ["9", "312"]);
  assert.deepEqual(toggleFeaturedItem(selected, "312"), ["9"]);
  assert.equal(toggleFeaturedItem(Array.from({ length: 20 }, (_, index) => String(index)), "300").length, 20);
});
