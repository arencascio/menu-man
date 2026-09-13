import assert from "node:assert/strict";
import test from "node:test";
import {
  fakeAuthorizationActionRequestSchema,
  fakeLateSuccessResolutionRequestSchema,
  fakePaymentRecoveryRequestSchema,
  paymentStatusSchema,
  paymentSubmissionRequestSchema,
} from "./contracts";

test("payment submission accepts only opaque bounded input and UUID attempt keys", () => {
  assert.equal(paymentSubmissionRequestSchema.safeParse({
    clientAttemptKey: "10000000-0000-4000-8000-000000000001",
    paymentMethodToken: "fake:success",
  }).success, true);
  assert.equal(paymentSubmissionRequestSchema.safeParse({
    clientAttemptKey: "not-a-uuid",
    paymentMethodToken: "fake:success",
    amountCents: 1,
  }).success, false);
  assert.equal(paymentSubmissionRequestSchema.safeParse({
    checkoutToken: "x".repeat(43),
    clientAttemptKey: "10000000-0000-4000-8000-000000000001",
    paymentMethodToken: "fake:success",
  }).success, false);
});

test("fake exceptional-state controls require one idempotent terminal action", () => {
  const key = "10000000-0000-4000-8000-000000000001";
  assert.equal(fakeAuthorizationActionRequestSchema.safeParse({ action: "capture", clientActionKey: key }).success, true);
  assert.equal(fakeAuthorizationActionRequestSchema.safeParse({ action: "refund", clientActionKey: key }).success, false);
  assert.equal(fakeLateSuccessResolutionRequestSchema.safeParse({ resolution: "refunded", clientActionKey: key }).success, true);
  assert.equal(fakeLateSuccessResolutionRequestSchema.safeParse({ resolution: "processing", clientActionKey: key }).success, false);
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

test("fake recovery accepts only a deterministic terminal resolution", () => {
  assert.equal(fakePaymentRecoveryRequestSchema.safeParse({
    resolution: "succeeded",
  }).success, true);
  assert.equal(fakePaymentRecoveryRequestSchema.safeParse({
    resolution: "processing",
  }).success, false);
  assert.equal(fakePaymentRecoveryRequestSchema.safeParse({
    resolution: "failed",
    clientAttemptKey: "10000000-0000-4000-8000-000000000001",
  }).success, false);
});
