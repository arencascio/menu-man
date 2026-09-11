import assert from "node:assert/strict";
import test from "node:test";
import { paymentStatusSchema, paymentSubmissionRequestSchema } from "./contracts";

test("payment submission accepts only opaque bounded input and UUID attempt keys", () => {
  assert.equal(paymentSubmissionRequestSchema.safeParse({
    checkoutToken: "x".repeat(43),
    clientAttemptKey: "10000000-0000-4000-8000-000000000001",
    paymentMethodToken: "fake:success",
  }).success, true);
  assert.equal(paymentSubmissionRequestSchema.safeParse({
    checkoutToken: "short",
    clientAttemptKey: "not-a-uuid",
    paymentMethodToken: "fake:success",
    amountCents: 1,
  }).success, false);
});

test("payment status is provider-neutral", () => {
  assert.equal(paymentStatusSchema.safeParse({
    paymentId: "10000000-0000-4000-8000-000000000001",
    orderId: "20000000-0000-4000-8000-000000000001",
    connectionId: "30000000-0000-4000-8000-000000000001",
    provider: "fake",
    providerEnvironment: "test",
    status: "processing",
    orderStatus: "pending_payment",
    paymentStatus: "pending",
    captureMode: "automatic",
    amountCents: 1250,
    currency: "USD",
    paymentDueAt: "2026-09-10T20:00:00.000Z",
    paidAt: null,
    latestAttempt: null,
  }).success, true);
});

