export function fakePaymentRuntimeAllowed(input: {
  menuManEnvironment?: string;
  nodeEnvironment?: string;
  explicitlyEnabled?: string;
}) {
  const { menuManEnvironment, nodeEnvironment, explicitlyEnabled } = input;
  if (menuManEnvironment === "production") return false;

  const nonProductionRuntime = menuManEnvironment === "staging"
    || menuManEnvironment === "development"
    || nodeEnvironment === "development"
    || nodeEnvironment === "test";

  return nonProductionRuntime && explicitlyEnabled === "true";
}

export function isFakePaymentRuntimeEnabled() {
  return fakePaymentRuntimeAllowed({
    menuManEnvironment: process.env.MENU_MAN_ENV,
    nodeEnvironment: process.env.NODE_ENV,
    explicitlyEnabled: process.env.MENU_MAN_ENABLE_FAKE_PAYMENTS,
  });
}

export function fakePaymentRecoveryRuntimeAllowed(input: {
  menuManEnvironment?: string;
  nodeEnvironment?: string;
  explicitlyEnabled?: string;
}) {
  return input.menuManEnvironment === "staging" && fakePaymentRuntimeAllowed(input);
}

export function isFakePaymentRecoveryRuntimeEnabled() {
  return fakePaymentRecoveryRuntimeAllowed({
    menuManEnvironment: process.env.MENU_MAN_ENV,
    nodeEnvironment: process.env.NODE_ENV,
    explicitlyEnabled: process.env.MENU_MAN_ENABLE_FAKE_PAYMENTS,
  });
}

export function requireFakeWebhookSecret() {
  const secret = process.env.MENU_MAN_FAKE_WEBHOOK_SECRET;
  if (!isFakePaymentRuntimeEnabled() || !secret || secret.length < 32) {
    throw new Error("The fake payment provider is not configured for this non-production environment.");
  }
  return secret;
}

export function squareSandboxRuntimeAllowed(input: {
  menuManEnvironment?: string;
  nodeEnvironment?: string;
  vercelEnvironment?: string;
  explicitlyEnabled?: string;
}) {
  if (input.menuManEnvironment === "production" || input.vercelEnvironment === "production") return false;
  const nonProductionRuntime = input.menuManEnvironment === "staging"
    || input.menuManEnvironment === "development"
    || input.nodeEnvironment === "development"
    || input.nodeEnvironment === "test";
  return nonProductionRuntime && input.explicitlyEnabled === "true";
}

export function isSquareSandboxRuntimeEnabled() {
  return squareSandboxRuntimeAllowed({
    menuManEnvironment: process.env.MENU_MAN_ENV,
    nodeEnvironment: process.env.NODE_ENV,
    vercelEnvironment: process.env.VERCEL_ENV,
    explicitlyEnabled: process.env.MENU_MAN_ENABLE_SQUARE_SANDBOX,
  });
}
