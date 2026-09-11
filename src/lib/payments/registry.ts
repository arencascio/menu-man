import "server-only";

import type { PaymentProviderAdapter } from "./adapter";
import { FakePaymentProviderAdapter } from "./providers/fake/adapter";
import {
  isFakePaymentRecoveryRuntimeEnabled,
  isFakePaymentRuntimeEnabled,
  requireFakeWebhookSecret,
} from "./runtime";

export function getPaymentProvider(providerKey: string): PaymentProviderAdapter {
  if (providerKey === "fake" && isFakePaymentRuntimeEnabled()) {
    return new FakePaymentProviderAdapter(
      requireFakeWebhookSecret(),
      isFakePaymentRecoveryRuntimeEnabled(),
    );
  }
  throw new Error(`Payment provider is unavailable: ${providerKey}`);
}
