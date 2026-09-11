import "server-only";

import type { PaymentProviderAdapter } from "./adapter";
import { FakePaymentProviderAdapter } from "./providers/fake/adapter";
import { isFakePaymentRuntimeEnabled, requireFakeWebhookSecret } from "./runtime";

export function getPaymentProvider(providerKey: string): PaymentProviderAdapter {
  if (providerKey === "fake" && isFakePaymentRuntimeEnabled()) {
    return new FakePaymentProviderAdapter(requireFakeWebhookSecret());
  }
  throw new Error(`Payment provider is unavailable: ${providerKey}`);
}

