import "server-only";

import type { PaymentProviderAdapter } from "./adapter";
import { FakePaymentProviderAdapter } from "./providers/fake/adapter";
import { SquarePaymentProviderAdapter } from "./providers/square/adapter";
import { requireSquareSandboxConfig } from "./providers/square/config";
import {
  isFakePaymentRecoveryRuntimeEnabled,
  isFakePaymentRuntimeEnabled,
  requireFakeWebhookSecret,
  isSquareSandboxRuntimeEnabled,
} from "./runtime";

export function getPaymentProvider(providerKey: string): PaymentProviderAdapter {
  if (providerKey === "fake" && isFakePaymentRuntimeEnabled()) {
    return new FakePaymentProviderAdapter(
      requireFakeWebhookSecret(),
      isFakePaymentRecoveryRuntimeEnabled(),
    );
  }
  if (providerKey === "square" && isSquareSandboxRuntimeEnabled()) {
    return new SquarePaymentProviderAdapter(requireSquareSandboxConfig());
  }
  throw new Error(`Payment provider is unavailable: ${providerKey}`);
}
