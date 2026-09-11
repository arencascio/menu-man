import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { CreatePaymentInput, CreateRefundInput, PaymentProviderAdapter } from "../../adapter";
import type {
  BrowserPaymentSession,
  ConnectionSnapshot,
  NormalizedPaymentEvent,
  OnboardingAction,
  PaymentCommandResult,
  PaymentConnectionContext,
  ProviderWebhookDelivery,
  RefundCommandResult,
  VerifiedProviderWebhook,
} from "../../types";

export const fakePaymentScenarios = [
  "success",
  "decline",
  "timeout_unknown",
  "delayed_success",
  "duplicate_webhook",
  "out_of_order",
  "authorization_only",
  "refund",
  "late_success",
] as const;

type FakeScenario = typeof fakePaymentScenarios[number];

type FakeWebhookPayload = {
  id: string;
  type: NormalizedPaymentEvent["kind"];
  occurredAt: string;
  availableAt: string;
  data: Omit<NormalizedPaymentEvent, "eventId" | "kind" | "occurredAt" | "availableAt">;
};

function makeReference(prefix: string, id: string) {
  return `${prefix}_${id.replaceAll("-", "").slice(0, 24)}`;
}

export class FakePaymentProviderAdapter implements PaymentProviderAdapter {
  readonly key = "fake";

  constructor(private readonly signingSecret: string) {}

  async beginOnboarding(input: PaymentConnectionContext): Promise<OnboardingAction> {
    if (input.environment !== "test") throw new Error("Fake payments require a test connection.");
    return { mode: "complete", providerSessionReference: `fake_onboarding_${input.connectionId}` };
  }

  async refreshConnection(input: PaymentConnectionContext): Promise<ConnectionSnapshot> {
    if (input.environment !== "test") throw new Error("Fake payments require a test connection.");
    return {
      status: "active",
      capabilities: ["accept_payments", "refunds", "manual_capture"],
      providerAccountReference: `fake_account_${input.connectionId}`,
      providerMetadata: { testOnly: true },
    };
  }

  async disconnect(): Promise<ConnectionSnapshot> {
    return { status: "disconnected", capabilities: [] };
  }

  async createBrowserSession(input: PaymentConnectionContext): Promise<BrowserPaymentSession> {
    if (input.environment !== "test") throw new Error("Fake payments require a test connection.");
    return {
      mode: "embedded",
      provider: "fake",
      publicConfig: {
        scenarios: [...fakePaymentScenarios],
        warning: "Test provider only. No payment details are collected.",
      },
    };
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentCommandResult> {
    if (input.environment !== "test") throw new Error("Fake payments require a test connection.");
    const scenario = input.paymentMethodToken.replace(/^fake:/, "") as FakeScenario;
    if (!fakePaymentScenarios.includes(scenario)) {
      return {
        status: "failed",
        providerStatus: "INVALID_TEST_TOKEN",
        failureCategory: "invalid_payment_method",
        failureCode: "INVALID_TEST_TOKEN",
        failureMessage: "The selected fake payment scenario is invalid.",
      };
    }

    const providerPaymentReference = makeReference("fake_pay", input.attemptId);
    const providerTransactionReference = makeReference("fake_txn", input.attemptId);
    const eventBase = {
      connectionId: input.connectionId,
      attemptId: input.attemptId,
      amountCents: input.amountCents,
      currency: input.currency,
      providerPaymentReference,
      providerTransactionReference,
    };

    if (scenario === "timeout_unknown") {
      return {
        status: "unknown",
        providerStatus: "NETWORK_OUTCOME_UNKNOWN",
        providerPaymentReference,
      };
    }

    const deliveries: ProviderWebhookDelivery[] = [];
    if (scenario === "decline") {
      deliveries.push(this.delivery("payment.failed", {
        ...eventBase,
        providerStatus: "DECLINED",
        failureCategory: "provider_decline",
        failureCode: "CARD_DECLINED",
        failureMessage: "The fake provider declined this payment.",
      }));
    } else if (scenario === "authorization_only") {
      deliveries.push(this.delivery("payment.authorized", {
        ...eventBase,
        providerStatus: "AUTHORIZED",
      }));
    } else if (scenario === "delayed_success") {
      deliveries.push(this.delivery("payment.succeeded", {
        ...eventBase,
        providerStatus: "SUCCEEDED",
      }, 1500));
    } else if (scenario === "duplicate_webhook") {
      const delivery = this.delivery("payment.succeeded", {
        ...eventBase,
        providerStatus: "SUCCEEDED",
      });
      deliveries.push(delivery, delivery);
    } else if (scenario === "out_of_order") {
      deliveries.push(
        this.delivery("payment.succeeded", { ...eventBase, providerStatus: "SUCCEEDED" }),
        this.delivery("payment.processing", { ...eventBase, providerStatus: "PROCESSING" }, 0, -1000),
      );
    } else if (scenario === "late_success") {
      deliveries.push(
        this.delivery("payment.cancelled", { ...eventBase, providerStatus: "CANCELLED" }),
        this.delivery("payment.succeeded", { ...eventBase, providerStatus: "SUCCEEDED" }, 1500),
      );
    } else {
      deliveries.push(this.delivery("payment.succeeded", {
        ...eventBase,
        providerStatus: "SUCCEEDED",
      }));
    }

    return {
      status: "processing",
      providerStatus: "SUBMITTED",
      providerPaymentReference,
      providerTransactionReference,
      providerMetadata: { fakeScenario: scenario },
      developmentWebhookDeliveries: deliveries,
    };
  }

  async retrievePayment(input: PaymentConnectionContext & { providerPaymentReference: string }): Promise<PaymentCommandResult> {
    return { status: "processing", providerStatus: "UNCHANGED", providerPaymentReference: input.providerPaymentReference };
  }

  async capturePayment(input: PaymentConnectionContext & { providerPaymentReference: string; amountCents: number }): Promise<PaymentCommandResult> {
    return { status: "processing", providerStatus: "CAPTURE_SUBMITTED", providerPaymentReference: input.providerPaymentReference };
  }

  async cancelPayment(input: PaymentConnectionContext & { providerPaymentReference: string }): Promise<PaymentCommandResult> {
    return { status: "processing", providerStatus: "CANCEL_SUBMITTED", providerPaymentReference: input.providerPaymentReference };
  }

  async createRefund(input: CreateRefundInput): Promise<RefundCommandResult> {
    const providerRefundReference = makeReference("fake_ref", input.refundId);
    return {
      status: "processing",
      providerStatus: "REFUND_SUBMITTED",
      providerRefundReference,
      developmentWebhookDeliveries: [this.delivery("refund.succeeded", {
        connectionId: input.connectionId,
        refundId: input.refundId,
        amountCents: input.amountCents,
        currency: input.currency,
        providerRefundReference,
        providerStatus: "SUCCEEDED",
      })],
    };
  }

  async retrieveRefund(input: PaymentConnectionContext & { providerRefundReference: string }): Promise<RefundCommandResult> {
    return { status: "processing", providerStatus: "UNCHANGED", providerRefundReference: input.providerRefundReference };
  }

  verifyWebhook(rawBody: string, headers: Headers): VerifiedProviderWebhook {
    const signatureHeader = headers.get("fake-payment-signature") || "";
    const match = signatureHeader.match(/^t=(\d+),v1=([0-9a-f]{64})$/);
    if (!match) throw new Error("Fake webhook signature is missing or malformed.");
    const timestamp = Number(match[1]);
    if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
      throw new Error("Fake webhook timestamp is outside the replay window.");
    }
    const expected = createHmac("sha256", this.signingSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest();
    const received = Buffer.from(match[2], "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new Error("Fake webhook signature is invalid.");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    if (typeof payload.id !== "string") throw new Error("Fake webhook event ID is missing.");
    return { eventId: payload.id, environment: "test", rawBody, payload };
  }

  normalizeWebhook(webhook: VerifiedProviderWebhook): NormalizedPaymentEvent[] {
    const payload = webhook.payload as unknown as FakeWebhookPayload;
    if (!payload.type || !payload.occurredAt || !payload.availableAt || !payload.data) {
      throw new Error("Fake webhook payload is invalid.");
    }
    return [{
      eventId: payload.id,
      kind: payload.type,
      occurredAt: payload.occurredAt,
      availableAt: payload.availableAt,
      ...payload.data,
    }];
  }

  private delivery(
    kind: NormalizedPaymentEvent["kind"],
    data: FakeWebhookPayload["data"],
    delayMilliseconds = 0,
    occurredOffsetMilliseconds = delayMilliseconds,
  ): ProviderWebhookDelivery {
    const now = new Date();
    const availableAt = new Date(now.getTime() + delayMilliseconds).toISOString();
    const payload: FakeWebhookPayload = {
      id: `fake_evt_${randomUUID()}`,
      type: kind,
      occurredAt: new Date(now.getTime() + occurredOffsetMilliseconds).toISOString(),
      availableAt,
      data,
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", this.signingSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    return {
      rawBody,
      headers: { "fake-payment-signature": `t=${timestamp},v1=${signature}` },
      availableAt,
    };
  }
}
