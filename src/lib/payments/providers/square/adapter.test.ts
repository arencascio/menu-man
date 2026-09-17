import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { SquareError, SquareTimeoutError, type Location, type Payment, type PaymentRefund } from "square";
import { SquarePaymentProviderAdapter } from "./adapter";
import type { SquareGateway } from "./client";
import { SQUARE_API_VERSION, type SquareSandboxConfig } from "./config";
import {
  paymentCommandResult,
  paymentEvent,
  refundEvent,
  squareErrorResult,
} from "./mappers";

const config: SquareSandboxConfig = {
  applicationId: "sandbox-sq0idb-test",
  accessToken: "sandbox-access-token-never-exposed",
  merchantId: "sandbox-merchant",
  locationId: "sandbox-location",
  webhookSignatureKey: "sandbox-webhook-signature-key",
  webhookNotificationUrl: "https://preview.example.com/api/webhooks/payments/square/sandbox",
  apiVersion: SQUARE_API_VERSION,
};

const connection = {
  connectionId: "10000000-0000-4000-8000-000000000001",
  provider: "square",
  environment: "sandbox" as const,
};

const completedPayment = {
  id: "square-payment-1",
  status: "COMPLETED",
  referenceId: "20000000-0000-4000-8000-000000000001",
  locationId: config.locationId,
  amountMoney: { amount: BigInt(1250), currency: "USD" },
  totalMoney: { amount: BigInt(1250), currency: "USD" },
  createdAt: "2026-09-12T18:00:00.000Z",
  updatedAt: "2026-09-12T18:00:01.000Z",
} as Payment;

const completedRefund = {
  id: "square-refund-1",
  paymentId: completedPayment.id,
  locationId: config.locationId,
  status: "COMPLETED",
  amountMoney: { amount: BigInt(1250), currency: "USD" },
  createdAt: "2026-09-12T18:01:00.000Z",
  updatedAt: "2026-09-12T18:01:01.000Z",
} as PaymentRefund;

function gateway(overrides: Partial<SquareGateway> = {}) {
  return {
    createPayment: async () => completedPayment,
    getPayment: async () => completedPayment,
    findPaymentByReference: async () => completedPayment,
    completePayment: async () => completedPayment,
    cancelPayment: async () => ({ ...completedPayment, status: "CANCELED" }) as Payment,
    createRefund: async () => completedRefund,
    getRefund: async () => completedRefund,
    getLocation: async () => ({
      id: config.locationId,
      merchantId: config.merchantId,
      status: "ACTIVE",
      country: "US",
      currency: "USD",
      capabilities: ["CREDIT_CARD_PROCESSING"],
    }) as Location,
    ...overrides,
  } satisfies SquareGateway;
}

const paymentInput = {
  ...connection,
  attemptId: "20000000-0000-4000-8000-000000000001",
  paymentId: "30000000-0000-4000-8000-000000000001",
  orderId: "40000000-0000-4000-8000-000000000001",
  providerIdempotencyKey: "20000000-0000-4000-8000-000000000001",
  paymentMethodToken: "cnon:card-nonce-ok",
  amountCents: 1250,
  currency: "USD",
  captureMode: "automatic" as const,
};

test("Square browser session exposes only public Sandbox card configuration", async () => {
  const adapter = new SquarePaymentProviderAdapter(config, gateway());
  const session = await adapter.createBrowserSession(connection);
  assert.equal(session.provider, "square");
  assert.equal(session.publicConfig.applicationId, config.applicationId);
  assert.equal(session.publicConfig.locationId, config.locationId);
  assert.equal(JSON.stringify(session).includes(config.accessToken), false);
  assert.equal(JSON.stringify(session).includes(config.webhookSignatureKey), false);
});

test("Square CreatePayment uses the Menu Man attempt identity, authoritative total, and capture mode", async () => {
  let request: Parameters<SquareGateway["createPayment"]>[0] | undefined;
  const adapter = new SquarePaymentProviderAdapter(config, gateway({
    createPayment: async (input) => {
      request = input;
      return completedPayment;
    },
  }));

  const result = await adapter.createPayment(paymentInput);
  assert.deepEqual(request, {
    sourceId: paymentInput.paymentMethodToken,
    idempotencyKey: paymentInput.providerIdempotencyKey,
    amountCents: paymentInput.amountCents,
    autocomplete: true,
    locationId: config.locationId,
    referenceId: paymentInput.attemptId,
  });
  assert.equal(result.status, "processing");
  assert.equal(result.providerPaymentReference, completedPayment.id);

  await adapter.createPayment({ ...paymentInput, captureMode: "manual" });
  assert.equal(request?.autocomplete, false);
});

test("Square payment statuses normalize without treating an unverified command success as paid", () => {
  const expectedKinds = new Map<string, string>([
    ["PENDING", "payment.processing"],
    ["APPROVED", "payment.authorized"],
    ["COMPLETED", "payment.succeeded"],
    ["FAILED", "payment.failed"],
    ["CANCELED", "payment.cancelled"],
  ]);

  for (const [status, kind] of expectedKinds) {
    const payment = { ...completedPayment, status } as Payment;
    const event = paymentEvent(payment, {
      eventId: `event-${status.toLowerCase()}`,
      attemptId: paymentInput.attemptId,
    });
    assert.equal(event?.kind, kind);
    assert.equal(event?.attemptId, paymentInput.attemptId);
  }

  assert.equal(paymentCommandResult(completedPayment).status, "processing");
  assert.equal(paymentCommandResult({ ...completedPayment, status: "FAILED" } as Payment).status, "failed");
  assert.equal(paymentEvent({ ...completedPayment, status: "UNKNOWN" } as Payment, {
    eventId: "event-unknown",
  }), undefined);
});

test("Square errors separate conclusive card failures from ambiguous provider outcomes", () => {
  const declined = squareErrorResult(new SquareError({
    statusCode: 402,
    body: { errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED", detail: "private detail" }] },
  }));
  assert.equal(declined.status, "failed");
  assert.equal(declined.failureCategory, "provider_decline");
  assert.equal(declined.failureCode, "CARD_DECLINED");
  assert.equal(declined.failureMessage?.includes("private detail"), false);

  for (const code of ["CVV_FAILURE", "INVALID_POSTAL_CODE", "INVALID_EXPIRATION", "INSUFFICIENT_FUNDS"]) {
    const result = squareErrorResult(new SquareError({
      statusCode: 400,
      body: { errors: [{ category: "INVALID_REQUEST_ERROR", code }] },
    }));
    assert.equal(result.status, "failed");
    assert.equal(result.failureCategory, "provider_decline");
  }

  const configuration = squareErrorResult(new SquareError({
    statusCode: 400,
    body: { errors: [{ category: "INVALID_REQUEST_ERROR", code: "BAD_REQUEST" }] },
  }));
  assert.equal(configuration.status, "failed");
  assert.equal(configuration.failureCategory, "provider_configuration");

  const throttled = squareErrorResult(new SquareError({
    statusCode: 429,
    body: { errors: [{ category: "RATE_LIMIT_ERROR", code: "RATE_LIMITED" }] },
  }));
  assert.equal(throttled.status, "unknown");
  assert.equal(throttled.failureCategory, "provider_unavailable");

  const serverFailure = squareErrorResult(new SquareError({
    statusCode: 503,
    body: { errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR" }] },
  }));
  assert.equal(serverFailure.status, "unknown");
  assert.equal(squareErrorResult(new SquareTimeoutError("timed out")).status, "unknown");
  assert.equal(squareErrorResult(new Error("connection reset")).status, "unknown");
});

test("Square refund statuses normalize for processing, success, and terminal failure", () => {
  const expectedKinds = new Map<string, string>([
    ["PENDING", "refund.processing"],
    ["COMPLETED", "refund.succeeded"],
    ["FAILED", "refund.failed"],
    ["REJECTED", "refund.failed"],
  ]);
  for (const [status, kind] of expectedKinds) {
    const event = refundEvent({ ...completedRefund, status } as PaymentRefund, {
      eventId: `refund-${status.toLowerCase()}`,
      refundId: "50000000-0000-4000-8000-000000000001",
    });
    assert.equal(event?.kind, kind);
  }
});

test("Square reconciliation is read-only and can discover an ambiguous payment by attempt reference", async () => {
  let searched = false;
  const adapter = new SquarePaymentProviderAdapter(config, gateway({
    getPayment: async () => { throw new Error("GetPayment must not run without a provider reference."); },
    findPaymentByReference: async (input) => {
      searched = true;
      assert.equal(input.referenceId, paymentInput.attemptId);
      assert.equal(input.amountCents, paymentInput.amountCents);
      return completedPayment;
    },
  }));
  const result = await adapter.retrievePayment({
    ...connection,
    attemptId: paymentInput.attemptId,
    paymentId: paymentInput.paymentId,
    orderId: paymentInput.orderId,
    amountCents: paymentInput.amountCents,
    currency: paymentInput.currency,
    createdAt: "2026-09-12T18:00:00.000Z",
  });
  assert.equal(searched, true);
  assert.equal(result.reconciliationEvent?.kind, "payment.succeeded");
  assert.equal(result.reconciliationEvent?.providerPaymentReference, completedPayment.id);
  assert.equal(result.reconciliationEvent?.attemptId, paymentInput.attemptId);
});

test("Square refund uses provider-neutral refund idempotency and authoritative amount", async () => {
  let request: Parameters<SquareGateway["createRefund"]>[0] | undefined;
  const adapter = new SquarePaymentProviderAdapter(config, gateway({
    createRefund: async (input) => {
      request = input;
      return completedRefund;
    },
  }));
  const result = await adapter.createRefund({
    ...connection,
    refundId: "50000000-0000-4000-8000-000000000001",
    paymentId: paymentInput.paymentId,
    providerIdempotencyKey: "50000000-0000-4000-8000-000000000001",
    providerPaymentReference: completedPayment.id!,
    amountCents: 1250,
    currency: "USD",
  });
  assert.equal(request?.idempotencyKey, "50000000-0000-4000-8000-000000000001");
  assert.equal(request?.paymentId, completedPayment.id);
  assert.equal(request?.amountCents, 1250);
  assert.equal(result.providerRefundReference, completedRefund.id);
  assert.equal(result.reconciliationEvent?.kind, "refund.succeeded");
  assert.equal(result.reconciliationEvent?.refundId, "50000000-0000-4000-8000-000000000001");
});

test("Square manual capture and void act on the existing provider payment", async () => {
  const actions: string[] = [];
  const adapter = new SquarePaymentProviderAdapter(config, gateway({
    completePayment: async (paymentId) => {
      actions.push(`capture:${paymentId}`);
      return completedPayment;
    },
    cancelPayment: async (paymentId) => {
      actions.push(`void:${paymentId}`);
      return { ...completedPayment, status: "CANCELED" } as Payment;
    },
  }));
  const actionInput = {
    ...paymentInput,
    providerPaymentReference: completedPayment.id!,
  };
  await adapter.capturePayment(actionInput);
  await adapter.cancelPayment(actionInput);
  assert.deepEqual(actions, [
    `capture:${completedPayment.id}`,
    `void:${completedPayment.id}`,
  ]);
});

test("Square verifies the exact raw webhook and stores only allowlisted payment fields", async () => {
  const adapter = new SquarePaymentProviderAdapter(config, gateway());
  const rawBody = JSON.stringify({
    merchant_id: config.merchantId,
    type: "payment.updated",
    event_id: "square-event-1",
    created_at: "2026-09-12T18:00:01.000Z",
    data: {
      type: "payment",
      id: completedPayment.id,
      object: {
        payment: {
          id: completedPayment.id,
          status: "COMPLETED",
          location_id: config.locationId,
          reference_id: paymentInput.attemptId,
          amount_money: { amount: 1250, currency: "USD" },
          total_money: { amount: 1250, currency: "USD" },
          created_at: completedPayment.createdAt,
          updated_at: completedPayment.updatedAt,
          application_details: { application_id: config.applicationId },
          buyer_email_address: "must-not-be-persisted@example.com",
          card_details: { card: { billing_address: { postal_code: "94103" } } },
        },
      },
    },
  });
  const signature = createHmac("sha256", config.webhookSignatureKey)
    .update(`${config.webhookNotificationUrl}${rawBody}`, "utf8")
    .digest("base64");
  const verified = await adapter.verifyWebhook(rawBody, new Headers({
    "x-square-hmacsha256-signature": signature,
  }));
  const [event] = adapter.normalizeWebhook(verified);
  assert.equal(event.kind, "payment.succeeded");
  assert.equal(event.attemptId, paymentInput.attemptId);
  const persisted = JSON.stringify(verified.sanitizedPayload);
  assert.equal(persisted.includes("must-not-be-persisted"), false);
  assert.equal(persisted.includes("billing_address"), false);

  await assert.rejects(() => adapter.verifyWebhook(`${rawBody} `, new Headers({
    "x-square-hmacsha256-signature": signature,
  })));
});

test("Square ignores signed events for a different merchant, location, or application", async () => {
  const adapter = new SquarePaymentProviderAdapter(config, gateway());
  async function normalized(overrides: {
    merchantId?: string;
    locationId?: string;
    applicationId?: string;
  }) {
    const rawBody = JSON.stringify({
      merchant_id: overrides.merchantId || config.merchantId,
      type: "payment.updated",
      event_id: crypto.randomUUID(),
      created_at: "2026-09-12T18:00:01.000Z",
      data: { object: { payment: {
        id: completedPayment.id,
        status: "COMPLETED",
        location_id: overrides.locationId || config.locationId,
        reference_id: paymentInput.attemptId,
        amount_money: { amount: 1250, currency: "USD" },
        application_details: { application_id: overrides.applicationId || config.applicationId },
      } } },
    });
    const signature = createHmac("sha256", config.webhookSignatureKey)
      .update(`${config.webhookNotificationUrl}${rawBody}`, "utf8")
      .digest("base64");
    return adapter.normalizeWebhook(await adapter.verifyWebhook(rawBody, new Headers({
      "x-square-hmacsha256-signature": signature,
    })));
  }

  assert.deepEqual(await normalized({ merchantId: "other-merchant" }), []);
  assert.deepEqual(await normalized({ locationId: "other-location" }), []);
  assert.deepEqual(await normalized({ applicationId: "other-application" }), []);
});

test("Square verifies and normalizes refund webhooks without retaining card or buyer data", async () => {
  const adapter = new SquarePaymentProviderAdapter(config, gateway());
  const rawBody = JSON.stringify({
    merchant_id: config.merchantId,
    type: "refund.updated",
    event_id: "square-refund-event-1",
    created_at: "2026-09-12T18:01:01.000Z",
    data: {
      type: "refund",
      id: completedRefund.id,
      object: {
        refund: {
          id: completedRefund.id,
          payment_id: completedPayment.id,
          status: "COMPLETED",
          location_id: config.locationId,
          amount_money: { amount: 1250, currency: "USD" },
          created_at: completedRefund.createdAt,
          updated_at: completedRefund.updatedAt,
          destination_details: { card_details: { card: { last_4: "1111" } } },
        },
      },
    },
  });
  const signature = createHmac("sha256", config.webhookSignatureKey)
    .update(`${config.webhookNotificationUrl}${rawBody}`, "utf8")
    .digest("base64");
  const verified = await adapter.verifyWebhook(rawBody, new Headers({
    "x-square-hmacsha256-signature": signature,
  }));
  const [event] = adapter.normalizeWebhook(verified);
  assert.equal(event.kind, "refund.succeeded");
  assert.equal(event.providerRefundReference, completedRefund.id);
  assert.equal(event.providerPaymentReference, completedPayment.id);
  assert.equal(JSON.stringify(verified.sanitizedPayload).includes("destination_details"), false);
});
