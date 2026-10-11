import assert from "node:assert/strict";
import test from "node:test";
import { getGalleryPickupHref } from "./restaurant-menu-links";

test("gallery pickup opens the canonical item on the existing dedicated menu route", () => {
  assert.equal(getGalleryPickupHref("/r/armandos/menu", "item-123"), "/r/armandos/menu?item=item-123");
  assert.equal(getGalleryPickupHref("/r/another/menu", "id/with space"), "/r/another/menu?item=id%2Fwith%20space");
});
