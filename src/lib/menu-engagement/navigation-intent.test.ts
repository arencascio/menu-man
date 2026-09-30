import assert from "node:assert/strict";
import test from "node:test";
import { clearSearchIntent, consumeNavigationIntent, searchIntent } from "./navigation-intent";

test("debounced search and ordinary clear carry distinct positioning intents", () => {
  assert.deepEqual(searchIntent(), { kind: "search" });
  assert.deepEqual(clearSearchIntent(), { kind: "menu-start" });
});

test("section navigation survives the search clear and is consumed after rendering", () => {
  const intent = clearSearchIntent("breakfast");
  assert.deepEqual(intent, { kind: "section", sectionId: "breakfast" });
  assert.deepEqual(consumeNavigationIntent(), { kind: "idle" });
});
