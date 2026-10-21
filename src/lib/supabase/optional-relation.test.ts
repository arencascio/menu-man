import assert from "node:assert/strict";
import test from "node:test";
import { isMissingOptionalRelation } from "./optional-relation";

test("only the named optional relation may fall back", () => {
  assert.equal(isMissingOptionalRelation({ code: "PGRST205", message: "Could not find the table 'public.restaurant_delivery_providers' in the schema cache" }, "restaurant_delivery_providers"), true);
  assert.equal(isMissingOptionalRelation({ code: "42P01", message: 'relation "restaurant_special_hours" does not exist' }, "restaurant_special_hours"), true);
  assert.equal(isMissingOptionalRelation({ code: "PGRST205", message: "Could not find the table 'public.orders'" }, "restaurant_delivery_providers"), false);
  assert.equal(isMissingOptionalRelation({ code: "42501", message: "permission denied for public.restaurant_delivery_providers" }, "restaurant_delivery_providers"), false);
  assert.equal(isMissingOptionalRelation(null, "restaurant_delivery_providers"), false);
});
