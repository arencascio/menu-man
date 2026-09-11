import type { PaymentStatus } from "./types";

export const LONG_PROCESSING_THRESHOLD_MS = 8_000;

export type PaymentProcessingPresentation = "none" | "short" | "uncertain";

export function getPaymentProcessingPresentation(
  payment: PaymentStatus | null,
  hasExceededThreshold: boolean,
): PaymentProcessingPresentation {
  if (payment?.status !== "processing") return "none";
  if (payment.latestAttempt?.status === "unknown" || hasExceededThreshold) return "uncertain";
  return "short";
}

export function isServerMarkedPaymentExpired(payment: PaymentStatus, nowMs = Date.now()) {
  return payment.status === "cancelled"
    && payment.orderStatus === "cancelled"
    && payment.latestAttempt?.status !== "cancelled"
    && Date.parse(payment.paymentDueAt) <= nowMs;
}

export function shouldExpirePaymentOnStatusRead(payment: PaymentStatus, nowMs = Date.now()) {
  return payment.orderStatus === "pending_payment"
    && ["requires_payment_method", "failed"].includes(payment.status)
    && Date.parse(payment.paymentDueAt) <= nowMs;
}

export function paymentLocksCart(payment: PaymentStatus, nowMs = Date.now()) {
  if (payment.orderStatus === "placed") return false;
  if (isServerMarkedPaymentExpired(payment, nowMs)) return false;
  if (payment.orderStatus === "pending_payment") return true;
  return payment.orderStatus === "cancelled" && payment.status !== "failed";
}

export function getCustomerPaymentStatusLabel(payment: PaymentStatus, nowMs = Date.now()) {
  if (isServerMarkedPaymentExpired(payment, nowMs)) return "Payment expired";
  if (payment.orderStatus === "placed") return "Paid and placed";
  if (payment.status === "succeeded") return "Payment confirmed; order requires review";
  if (payment.latestAttempt?.status === "unknown") return "Confirmation pending";
  if (payment.status === "failed") return "Payment declined";
  if (payment.status === "authorized") return "Payment authorized";
  if (payment.status === "processing") return "Payment processing";
  if (payment.orderStatus === "cancelled") return "Order cancelled";
  return "Awaiting payment";
}
