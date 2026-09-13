import { SquareError, SquareTimeoutError, type Payment, type PaymentRefund } from "square";
import type { PaymentCommandResult, NormalizedPaymentEvent, RefundCommandResult } from "../../types";

type ReconciliationContext = {
  eventId: string;
  connectionId?: string;
  attemptId?: string;
  refundId?: string;
  providerAccountReference?: string;
  providerLocationReference?: string;
  providerPaymentReference?: string;
};

const invalidMethodCodes = new Set([
  "ADDRESS_VERIFICATION_FAILURE", "CARD_EXPIRED", "CARD_NOT_SUPPORTED", "CARD_TOKEN_EXPIRED",
  "CARD_TOKEN_USED", "CVV_FAILURE", "EXPIRATION_FAILURE", "INVALID_CARD", "INVALID_CARD_DATA",
  "INVALID_EXPIRATION", "INVALID_POSTAL_CODE", "INVALID_SOURCE", "VERIFY_CVV_FAILURE",
  "VERIFY_AVS_FAILURE",
]);

function money(payment: Payment) {
  return payment.totalMoney || payment.amountMoney;
}

function safeNumber(value: bigint | null | undefined) {
  if (value == null || value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    return undefined;
  }
  return Number(value);
}

export function paymentCommandResult(payment: Payment): PaymentCommandResult {
  const providerStatus = payment.status || "UNKNOWN";
  if (providerStatus === "FAILED") {
    return {
      status: "failed",
      providerStatus,
      providerPaymentReference: payment.id,
      failureCategory: "provider_decline",
      failureCode: "PAYMENT_FAILED",
      failureMessage: "The payment provider declined this payment.",
    };
  }
  return {
    status: "processing",
    providerStatus,
    providerPaymentReference: payment.id,
    providerMetadata: {
      updatedAt: payment.updatedAt,
      versionToken: payment.versionToken,
    },
  };
}

export function paymentEvent(payment: Payment, context: ReconciliationContext): NormalizedPaymentEvent | undefined {
  const status = payment.status;
  const kind = status === "COMPLETED" ? "payment.succeeded"
    : status === "APPROVED" ? "payment.authorized"
      : status === "PENDING" ? "payment.processing"
        : status === "FAILED" ? "payment.failed"
          : status === "CANCELED" ? "payment.cancelled"
            : undefined;
  if (!kind) return undefined;
  const amount = money(payment);
  return {
    eventId: context.eventId,
    kind,
    occurredAt: payment.updatedAt || payment.createdAt || new Date().toISOString(),
    availableAt: new Date().toISOString(),
    connectionId: context.connectionId,
    attemptId: context.attemptId,
    providerAccountReference: context.providerAccountReference,
    providerLocationReference: payment.locationId || context.providerLocationReference,
    amountCents: safeNumber(amount?.amount),
    currency: amount?.currency,
    providerPaymentReference: payment.id || context.providerPaymentReference,
    providerStatus: status || "UNKNOWN",
    failureCategory: kind === "payment.failed" ? "provider_decline" : undefined,
    failureCode: kind === "payment.failed" ? "PAYMENT_FAILED" : undefined,
    failureMessage: kind === "payment.failed" ? "The payment provider declined this payment." : undefined,
  };
}

export function refundCommandResult(refund: PaymentRefund): RefundCommandResult {
  const failed = refund.status === "FAILED" || refund.status === "REJECTED";
  return {
    status: failed ? "failed" : "processing",
    providerStatus: refund.status || "UNKNOWN",
    providerRefundReference: refund.id,
    failureCategory: failed ? "provider_refund_failed" : undefined,
    failureCode: failed ? `REFUND_${refund.status}` : undefined,
    failureMessage: failed ? "The payment provider could not complete the refund." : undefined,
    providerMetadata: { updatedAt: refund.updatedAt },
  };
}

export function refundEvent(refund: PaymentRefund, context: ReconciliationContext): NormalizedPaymentEvent | undefined {
  const kind = refund.status === "COMPLETED" ? "refund.succeeded"
    : refund.status === "PENDING" ? "refund.processing"
      : refund.status === "FAILED" || refund.status === "REJECTED" ? "refund.failed"
        : undefined;
  if (!kind) return undefined;
  return {
    eventId: context.eventId,
    kind,
    occurredAt: refund.updatedAt || refund.createdAt || new Date().toISOString(),
    availableAt: new Date().toISOString(),
    connectionId: context.connectionId,
    refundId: context.refundId,
    providerAccountReference: context.providerAccountReference,
    providerLocationReference: refund.locationId || context.providerLocationReference,
    amountCents: safeNumber(refund.amountMoney.amount),
    currency: refund.amountMoney.currency,
    providerPaymentReference: refund.paymentId || context.providerPaymentReference,
    providerRefundReference: refund.id,
    providerStatus: refund.status || "UNKNOWN",
    failureCategory: kind === "refund.failed" ? "provider_refund_failed" : undefined,
    failureCode: kind === "refund.failed" ? `REFUND_${refund.status}` : undefined,
    failureMessage: kind === "refund.failed" ? "The payment provider could not complete the refund." : undefined,
  };
}

export function squareErrorResult(error: unknown): PaymentCommandResult {
  if (error instanceof SquareTimeoutError) {
    return { status: "unknown", providerStatus: "REQUEST_TIMEOUT", failureCategory: "provider_unavailable" };
  }
  if (error instanceof SquareError) {
    const first = error.errors[0];
    const code = first?.code || "SQUARE_ERROR";
    if (error.statusCode === 429 || (error.statusCode != null && error.statusCode >= 500)) {
      return { status: "unknown", providerStatus: code, failureCategory: "provider_unavailable" };
    }
    const failureCategory = code === "INSUFFICIENT_FUNDS"
      || invalidMethodCodes.has(code)
      || first?.category === "PAYMENT_METHOD_ERROR"
      ? "provider_decline"
      : "provider_configuration";
    return {
      status: "failed",
      providerStatus: code,
      failureCategory,
      failureCode: code,
      failureMessage: failureCategory === "provider_configuration"
        ? "The payment provider is not configured correctly."
        : "The payment provider declined this payment.",
    };
  }
  return { status: "unknown", providerStatus: "REQUEST_OUTCOME_UNKNOWN", failureCategory: "provider_unavailable" };
}

export function squareRefundErrorResult(error: unknown): RefundCommandResult {
  const paymentResult = squareErrorResult(error);
  return {
    status: paymentResult.status === "failed" ? "failed" : "processing",
    providerStatus: paymentResult.providerStatus,
    failureCategory: paymentResult.failureCategory,
    failureCode: paymentResult.failureCode,
    failureMessage: paymentResult.status === "failed" ? "The payment provider could not complete the refund." : undefined,
  };
}
