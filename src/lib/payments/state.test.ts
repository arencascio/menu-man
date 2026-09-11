import assert from "node:assert/strict";
import test from "node:test";
import {
  getCustomerPaymentStatusLabel,
  getPaymentProcessingPresentation,
  isServerMarkedPaymentExpired,
  paymentLocksCart,
  shouldExpirePaymentOnStatusRead,
} from "./state";
import type { PaymentStatus } from "./types";

const FUTURE = "2026-09-11T12:30:00.000Z";
const NOW = Date.parse("2026-09-11T12:00:00.000Z");

function payment(overrides: Partial<PaymentStatus> = {}): PaymentStatus {
  return {
    paymentId: "10000000-0000-4000-8000-000000000001",
    orderId: "20000000-0000-4000-8000-000000000001",
    connectionId: "30000000-0000-4000-8000-000000000001",
    provider: "fake",
    providerEnvironment: "test",
    status: "requires_payment_method",
    orderStatus: "pending_payment",
    paymentStatus: "unpaid",
    captureMode: "automatic",
    amountCents: 1250,
    currency: "USD",
    paymentDueAt: FUTURE,
    paidAt: null,
    latestAttempt: null,
    ...overrides,
  };
}

test("processing UX distinguishes short processing from unknown or unusually long processing", () => {
  const processing = payment({
    status: "processing",
    paymentStatus: "pending",
    latestAttempt: {
      attemptId: "40000000-0000-4000-8000-000000000001",
      status: "processing",
      failureCategory: null,
      failureCode: null,
      failureMessage: null,
    },
  });
  assert.equal(getPaymentProcessingPresentation(processing, false), "short");
  assert.equal(getPaymentProcessingPresentation(processing, true), "uncertain");
  assert.equal(getPaymentProcessingPresentation({
    ...processing,
    latestAttempt: { ...processing.latestAttempt!, status: "unknown" },
  }, false), "uncertain");
});

test("an expired label and unlocked cart require the server to have cancelled the payment", () => {
  const pastDuePending = payment({ paymentDueAt: "2026-09-11T11:30:00.000Z" });
  assert.equal(isServerMarkedPaymentExpired(pastDuePending, NOW), false);
  assert.equal(paymentLocksCart(pastDuePending, NOW), true);
  assert.equal(shouldExpirePaymentOnStatusRead(pastDuePending, NOW), true);

  const expired = payment({
    status: "cancelled",
    orderStatus: "cancelled",
    paymentStatus: "failed",
    paymentDueAt: "2026-09-11T11:30:00.000Z",
  });
  assert.equal(isServerMarkedPaymentExpired(expired, NOW), true);
  assert.equal(paymentLocksCart(expired, NOW), false);
  assert.equal(getCustomerPaymentStatusLabel(expired, NOW), "Payment expired");

  const providerCancelled = payment({
    status: "cancelled",
    orderStatus: "cancelled",
    paymentStatus: "failed",
    paymentDueAt: "2026-09-11T11:30:00.000Z",
    latestAttempt: {
      attemptId: "40000000-0000-4000-8000-000000000001",
      status: "cancelled",
      failureCategory: null,
      failureCode: null,
      failureMessage: null,
    },
  });
  assert.equal(isServerMarkedPaymentExpired(providerCancelled, NOW), false);
  assert.equal(paymentLocksCart(providerCancelled, NOW), true);
});

test("failed payments remain retryable and lock cart changes until server expiration", () => {
  const failed = payment({ status: "failed", paymentStatus: "failed" });
  assert.equal(paymentLocksCart(failed, NOW), true);
  assert.equal(shouldExpirePaymentOnStatusRead(failed, NOW), false);
  assert.equal(getCustomerPaymentStatusLabel(failed, NOW), "Payment declined");
});

test("a server-terminal decline unlocks the cart while preserving its reason", () => {
  const declined = payment({
    status: "failed",
    orderStatus: "cancelled",
    paymentStatus: "failed",
  });
  assert.equal(paymentLocksCart(declined, NOW), false);
  assert.equal(getCustomerPaymentStatusLabel(declined, NOW), "Payment declined");
});

test("a late success stays locked and is identified for review", () => {
  const lateSuccess = payment({
    status: "succeeded",
    orderStatus: "cancelled",
    paymentStatus: "paid",
    paidAt: "2026-09-11T12:05:00.000Z",
  });
  assert.equal(paymentLocksCart(lateSuccess, NOW), true);
  assert.equal(getCustomerPaymentStatusLabel(lateSuccess, NOW), "Payment confirmed; order requires review");
});
