import assert from "node:assert/strict";
import test from "node:test";
import { fakePaymentRuntimeAllowed } from "./runtime";

test("fake payments can never be enabled for the production Menu Man environment", () => {
  assert.equal(fakePaymentRuntimeAllowed({
    menuManEnvironment: "production",
    nodeEnvironment: "development",
    explicitlyEnabled: "true",
  }), false);
  assert.equal(fakePaymentRuntimeAllowed({
    menuManEnvironment: "staging",
    nodeEnvironment: "production",
    explicitlyEnabled: "true",
  }), true);
  assert.equal(fakePaymentRuntimeAllowed({
    menuManEnvironment: "staging",
    nodeEnvironment: "production",
    explicitlyEnabled: "false",
  }), false);
});
