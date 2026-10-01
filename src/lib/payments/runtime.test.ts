import assert from "node:assert/strict";
import test from "node:test";
import {
  fakePaymentRecoveryRuntimeAllowed,
  fakePaymentRuntimeAllowed,
  isFakePaymentRecoveryRuntimeEnabled,
  isFakePaymentRuntimeEnabled,
  requireFakeWebhookSecret,
  squareSandboxRuntimeAllowed,
} from "./runtime";

function withFakePaymentEnvironment(values: Record<string, string>, run: () => void) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  try {
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

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

test("Vercel production closes the fake gate used by preparation and provider resolution", () => {
  const configuration = {
    menuManEnvironment: "staging",
    nodeEnvironment: "production",
    vercelEnvironment: "production",
    explicitlyEnabled: "true",
  };
  assert.equal(fakePaymentRuntimeAllowed(configuration), false);
  assert.equal(fakePaymentRuntimeAllowed({
    ...configuration,
    menuManEnvironment: "development",
    nodeEnvironment: "development",
  }), false);

  withFakePaymentEnvironment({
    VERCEL_ENV: "production",
    MENU_MAN_ENV: "staging",
    MENU_MAN_ENABLE_FAKE_PAYMENTS: "true",
    MENU_MAN_FAKE_WEBHOOK_SECRET: "fake-test-signing-secret-that-is-long-enough",
  }, () => {
    assert.equal(isFakePaymentRuntimeEnabled(), false);
    assert.throws(requireFakeWebhookSecret, /not configured/);
  });
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

test("Vercel production disables fake recovery despite staging flags", () => {
  assert.equal(fakePaymentRecoveryRuntimeAllowed({
    menuManEnvironment: "staging",
    nodeEnvironment: "production",
    vercelEnvironment: "production",
    explicitlyEnabled: "true",
  }), false);

  withFakePaymentEnvironment({
    VERCEL_ENV: "production",
    MENU_MAN_ENV: "staging",
    MENU_MAN_ENABLE_FAKE_PAYMENTS: "true",
  }, () => assert.equal(isFakePaymentRecoveryRuntimeEnabled(), false));
});

test("staging Preview and local development keep explicitly enabled fake payments", () => {
  assert.equal(fakePaymentRuntimeAllowed({
    menuManEnvironment: "staging",
    nodeEnvironment: "production",
    vercelEnvironment: "preview",
    explicitlyEnabled: "true",
  }), true);
  assert.equal(fakePaymentRecoveryRuntimeAllowed({
    menuManEnvironment: "staging",
    nodeEnvironment: "production",
    vercelEnvironment: "preview",
    explicitlyEnabled: "true",
  }), true);
  assert.equal(fakePaymentRuntimeAllowed({
    nodeEnvironment: "development",
    explicitlyEnabled: "true",
  }), true);
  assert.equal(fakePaymentRecoveryRuntimeAllowed({
    menuManEnvironment: "development",
    nodeEnvironment: "development",
    explicitlyEnabled: "true",
  }), false);

  withFakePaymentEnvironment({
    VERCEL_ENV: "preview",
    MENU_MAN_ENV: "staging",
    MENU_MAN_ENABLE_FAKE_PAYMENTS: "true",
    MENU_MAN_FAKE_WEBHOOK_SECRET: "fake-test-signing-secret-that-is-long-enough",
  }, () => {
    assert.equal(isFakePaymentRuntimeEnabled(), true);
    assert.equal(isFakePaymentRecoveryRuntimeEnabled(), true);
    assert.equal(requireFakeWebhookSecret(), "fake-test-signing-secret-that-is-long-enough");
  });
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
