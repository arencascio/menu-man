import assert from "node:assert/strict";
import test from "node:test";
import { resolveDeliveryProviderBrand } from "./RestaurantDeliveryProviderIcon";

test("delivery provider branding recognizes keys and common provider names", () => {
  assert.equal(resolveDeliveryProviderBrand("doordash", "Custom label"), "doordash");
  assert.equal(resolveDeliveryProviderBrand(undefined, "Uber Eats"), "ubereats");
  assert.equal(resolveDeliveryProviderBrand(undefined, "A local courier"), null);
});
