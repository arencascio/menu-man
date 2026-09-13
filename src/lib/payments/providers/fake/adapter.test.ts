import assert from "node:assert/strict";
import test from "node:test";
import { FakePaymentProviderAdapter, fakePaymentScenarios } from "./adapter";

const SECRET = "fake-test-signing-secret-that-is-long-enough";
const CONNECTION = {
  connectionId: "10000000-0000-4000-8000-000000000001",
  provider: "fake",
  environment: "test" as const,
};
const PAYMENT = {
  ...CONNECTION,
  attemptId: "20000000-0000-4000-8000-000000000001",
  paymentId: "30000000-0000-4000-8000-000000000001",
  orderId: "40000000-0000-4000-8000-000000000001",
  providerIdempotencyKey: "20000000-0000-4000-8000-000000000001",
  amountCents: 1250,
  currency: "USD",
  captureMode: "automatic" as const,
};

test("fake provider exposes every deterministic scenario without card fields", async () => {
  const adapter = new FakePaymentProviderAdapter(SECRET);
  const session = await adapter.createBrowserSession(CONNECTION);
  assert.deepEqual(session.publicConfig.scenarios, [...fakePaymentScenarios]);
  assert.equal(session.publicConfig.exceptionControlsEnabled, false);
  assert.equal(JSON.stringify(session).includes("card"), false);
});

test("fake provider signs and normalizes a successful webhook", async () => {
  const adapter = new FakePaymentProviderAdapter(SECRET);
  const result = await adapter.createPayment({ ...PAYMENT, paymentMethodToken: "fake:success" });
  assert.equal(result.status, "processing");
  const delivery = result.developmentWebhookDeliveries?.[0];
  assert.ok(delivery);
  const verified = await adapter.verifyWebhook(delivery.rawBody, new Headers(delivery.headers));
  const [event] = adapter.normalizeWebhook(verified);
  assert.equal(event.kind, "payment.succeeded");
  assert.equal(event.amountCents, 1250);
  assert.equal(event.attemptId, PAYMENT.attemptId);
});

test("fake webhook verification rejects tampering", async () => {
  const adapter = new FakePaymentProviderAdapter(SECRET);
  const result = await adapter.createPayment({ ...PAYMENT, paymentMethodToken: "fake:success" });
  const delivery = result.developmentWebhookDeliveries?.[0];
  assert.ok(delivery);
  await assert.rejects(() => adapter.verifyWebhook(`${delivery.rawBody} `, new Headers(delivery.headers)));
});

test("fake provider produces duplicate and out-of-order deliveries deterministically", async () => {
  const adapter = new FakePaymentProviderAdapter(SECRET);
  const duplicate = await adapter.createPayment({ ...PAYMENT, paymentMethodToken: "fake:duplicate_webhook" });
  assert.equal(duplicate.developmentWebhookDeliveries?.length, 2);
  assert.equal(
    duplicate.developmentWebhookDeliveries?.[0].rawBody,
    duplicate.developmentWebhookDeliveries?.[1].rawBody,
  );

  const outOfOrder = await adapter.createPayment({ ...PAYMENT, paymentMethodToken: "fake:out_of_order" });
  const kinds = await Promise.all((outOfOrder.developmentWebhookDeliveries || []).map(async (delivery) => {
    const verified = await adapter.verifyWebhook(delivery.rawBody, new Headers(delivery.headers));
    return adapter.normalizeWebhook(verified)[0].kind;
  }));
  assert.deepEqual(kinds, ["payment.succeeded", "payment.processing"]);
});

test("fake provider covers decline, unknown, authorization, late success, and refund", async () => {
  const adapter = new FakePaymentProviderAdapter(SECRET);
  const decline = await adapter.createPayment({ ...PAYMENT, paymentMethodToken: "fake:decline" });
  assert.equal(decline.developmentWebhookDeliveries?.length, 1);
  const unknown = await adapter.createPayment({ ...PAYMENT, paymentMethodToken: "fake:timeout_unknown" });
  assert.equal(unknown.status, "unknown");
  assert.equal(unknown.developmentWebhookDeliveries, undefined);
  const authorization = await adapter.createPayment({ ...PAYMENT, paymentMethodToken: "fake:authorization_only" });
  assert.equal(authorization.developmentWebhookDeliveries?.length, 1);
  const late = await adapter.createPayment({ ...PAYMENT, paymentMethodToken: "fake:late_success" });
  assert.equal(late.developmentWebhookDeliveries?.length, 2);

  const refund = await adapter.createRefund({
    ...CONNECTION,
    refundId: "50000000-0000-4000-8000-000000000001",
    paymentId: PAYMENT.paymentId,
    providerIdempotencyKey: "50000000-0000-4000-8000-000000000001",
    providerPaymentReference: "fake_pay_example",
    amountCents: 1250,
    currency: "USD",
  });
  assert.equal(refund.developmentWebhookDeliveries?.length, 1);
  const delivery = refund.developmentWebhookDeliveries?.[0];
  assert.ok(delivery);
  const event = adapter.normalizeWebhook(await adapter.verifyWebhook(
    delivery.rawBody,
    new Headers(delivery.headers),
  ))[0];
  assert.equal(event.kind, "refund.succeeded");
});

test("fake unknown recovery signs terminal events for the original attempt", async () => {
  const adapter = new FakePaymentProviderAdapter(SECRET, true);
  for (const resolution of ["succeeded", "failed"] as const) {
    const delivery = adapter.createUnknownPaymentResolution({
      ...CONNECTION,
      attemptId: PAYMENT.attemptId,
      amountCents: PAYMENT.amountCents,
      currency: PAYMENT.currency,
      resolution,
    });
    const event = adapter.normalizeWebhook(await adapter.verifyWebhook(
      delivery.rawBody,
      new Headers(delivery.headers),
    ))[0];
    assert.equal(event.attemptId, PAYMENT.attemptId);
    assert.equal(event.kind, resolution === "succeeded" ? "payment.succeeded" : "payment.failed");
    assert.equal(event.amountCents, PAYMENT.amountCents);
  }
});

test("fake authorization capture and void emit verified events for the existing attempt", async () => {
  const adapter = new FakePaymentProviderAdapter(SECRET, true);
  const input = {
    ...PAYMENT,
    providerPaymentReference: "fake_pay_existing",
  };

  const capture = await adapter.capturePayment(input);
  const captureDelivery = capture.developmentWebhookDeliveries?.[0];
  assert.ok(captureDelivery);
  const captureEvent = adapter.normalizeWebhook(await adapter.verifyWebhook(
    captureDelivery.rawBody,
    new Headers(captureDelivery.headers),
  ))[0];
  assert.equal(captureEvent.kind, "payment.succeeded");
  assert.equal(captureEvent.attemptId, PAYMENT.attemptId);

  const voided = await adapter.cancelPayment(input);
  const voidDelivery = voided.developmentWebhookDeliveries?.[0];
  assert.ok(voidDelivery);
  const voidEvent = adapter.normalizeWebhook(await adapter.verifyWebhook(
    voidDelivery.rawBody,
    new Headers(voidDelivery.headers),
  ))[0];
  assert.equal(voidEvent.kind, "payment.failed");
  assert.equal(voidEvent.attemptId, PAYMENT.attemptId);
  assert.equal(voidEvent.failureCategory, "authorization_voided");
});
