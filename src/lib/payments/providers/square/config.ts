import { isSquareSandboxRuntimeEnabled } from "../../runtime";

export const SQUARE_API_VERSION = "2026-08-19" as const;
export const SQUARE_SANDBOX_SCRIPT_URL = "https://sandbox.web.squarecdn.com/v1/square.js";

export type SquareSandboxConfig = {
  applicationId: string;
  accessToken: string;
  merchantId: string;
  locationId: string;
  webhookSignatureKey: string;
  webhookNotificationUrl: string;
  apiVersion: typeof SQUARE_API_VERSION;
};

function requireValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Square Sandbox configuration is missing ${name}.`);
  return value;
}

export function requireSquareSandboxConfig(): SquareSandboxConfig {
  if (!isSquareSandboxRuntimeEnabled()) {
    throw new Error("Square Sandbox is disabled in this runtime.");
  }
  const apiVersion = requireValue("SQUARE_API_VERSION");
  if (apiVersion !== SQUARE_API_VERSION) {
    throw new Error(`Square API version must be pinned to ${SQUARE_API_VERSION}.`);
  }
  const webhookNotificationUrl = requireValue("SQUARE_SANDBOX_WEBHOOK_NOTIFICATION_URL");
  if (!webhookNotificationUrl.startsWith("https://")) {
    throw new Error("The Square Sandbox webhook notification URL must use HTTPS.");
  }
  return {
    applicationId: requireValue("SQUARE_SANDBOX_APPLICATION_ID"),
    accessToken: requireValue("SQUARE_SANDBOX_ACCESS_TOKEN"),
    merchantId: requireValue("SQUARE_SANDBOX_MERCHANT_ID"),
    locationId: requireValue("SQUARE_SANDBOX_LOCATION_ID"),
    webhookSignatureKey: requireValue("SQUARE_SANDBOX_WEBHOOK_SIGNATURE_KEY"),
    webhookNotificationUrl,
    apiVersion: SQUARE_API_VERSION,
  };
}
