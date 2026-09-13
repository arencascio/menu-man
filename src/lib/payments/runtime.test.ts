import assert from "node:assert/strict";
import test from "node:test";
import {
  fakePaymentRecoveryRuntimeAllowed,
  fakePaymentRuntimeAllowed,
  squareSandboxRuntimeAllowed,
} from "./runtime";

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

test("fake unknown recovery is exposed only in explicitly enabled staging", () => {
  assert.equal(fakePaymentRecoveryRuntimeAllowed({
    menuManEnvironment: "staging",
    nodeEnvironment: "production",
    explicitlyEnabled: "true",
  }), true);
  assert.equal(fakePaymentRecoveryRuntimeAllowed({
    menuManEnvironment: "development",
    nodeEnvironment: "development",
    explicitlyEnabled: "true",
  }), false);
  assert.equal(fakePaymentRecoveryRuntimeAllowed({
    menuManEnvironment: "production",
    nodeEnvironment: "development",
    explicitlyEnabled: "true",
  }), false);
});

test("Square Sandbox can never be enabled in the production Menu Man environment", () => {
  assert.equal(squareSandboxRuntimeAllowed({
    menuManEnvironment: "production",
    nodeEnvironment: "development",
    explicitlyEnabled: "true",
  }), false);
  assert.equal(squareSandboxRuntimeAllowed({
    menuManEnvironment: "staging",
    nodeEnvironment: "production",
    vercelEnvironment: "production",
    explicitlyEnabled: "true",
  }), false);
  assert.equal(squareSandboxRuntimeAllowed({
    menuManEnvironment: "staging",
    nodeEnvironment: "production",
    vercelEnvironment: "preview",
    explicitlyEnabled: "true",
  }), true);
  assert.equal(squareSandboxRuntimeAllowed({
    menuManEnvironment: "staging",
    nodeEnvironment: "production",
    explicitlyEnabled: "false",
  }), false);
});
