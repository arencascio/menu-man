import assert from "node:assert/strict";
import test from "node:test";
import type { MenuSection } from "@/app/r/[slug]/MenuBrowser";
import { composeMenuSections, composePersonalizedMenuSections } from "./sections";

const items = ["a", "b", "c", "d"].map((id) => ({ id, name: id, description: null, price_cents: 100, image_url: null, is_orderable: true, modifierGroups: [] }));
const sections: MenuSection[] = [
  { id: "source-1", name: "First", description: null, sort_order: 0, items: items.slice(0, 2) },
  { id: "source-2", name: "Second", description: null, sort_order: 1, items: items.slice(2) },
];

test("Featured and aggregate Popular sections precede unchanged source sections and reuse canonical items", () => {
  const result = composeMenuSections(sections, [{ item_id: "c", sort_order: 1 }, { item_id: "a", sort_order: 0 }], [
    { item_id: "b", heart_count: 4 }, { item_id: "a", heart_count: 4 }, { item_id: "d", heart_count: 1 },
  ]);
  assert.deepEqual(result.map((section) => section.id), ["featured", "popular", "source-1", "source-2"]);
  assert.deepEqual(result[0].items.map((item) => item.id), ["a", "c"]);
  assert.deepEqual(result[1].items.map((item) => item.id), ["a", "b"]);
  assert.equal(result[0].items[0], sections[0].items[0]);
  assert.equal(result[2], sections[0]);
});

test("empty and low engagement sections stay hidden", () => {
  assert.equal(composeMenuSections(sections, [], [{ item_id: "a", heart_count: 1 }]).length, 2);
  assert.equal(composeMenuSections(sections, [{ item_id: "missing", sort_order: 0 }], []).length, 2);
});

test("personal Favorites are distinct from aggregate Popular and update from canonical liked ids", () => {
  const aggregate = composeMenuSections(sections, [{ item_id: "c", sort_order: 0 }], [{ item_id: "b", heart_count: 4 }]);
  const liked = composePersonalizedMenuSections(aggregate, ["d", "a"]);
  assert.deepEqual(liked.map((section) => section.id), ["featured", "favorites", "popular", "source-1", "source-2"]);
  assert.deepEqual(liked.find((section) => section.id === "favorites")?.items.map((item) => item.id), ["d", "a"]);
  assert.deepEqual(composePersonalizedMenuSections(aggregate, []).map((section) => section.id), ["featured", "popular", "source-1", "source-2"]);
});
