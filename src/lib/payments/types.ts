export const paymentProviderKeys = ["fake", "square"] as const;

export type PaymentProviderKey = string;
export type CaptureMode = "automatic" | "manual";
export type PaymentCommandStatus = "processing" | "unknown" | "failed";
export type PaymentEventKind =
  | "payment.processing"
  | "payment.authorized"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.cancelled"
  | "refund.processing"
  | "refund.succeeded"
  | "refund.failed";

export type BrowserPaymentSession = {
  mode: "embedded";
  provider: PaymentProviderKey;
  publicConfig: Record<string, unknown>;
};

export type PaymentConnectionContext = {
  connectionId: string;
  provider: PaymentProviderKey;
  environment: "test" | "sandbox" | "production";
};

export type OnboardingAction = {
  mode: "redirect" | "complete";
  redirectUrl?: string;
  providerSessionReference?: string;
};

export type ConnectionSnapshot = {
  status: "onboarding" | "pending_review" | "active" | "restricted" | "disconnected" | "error";
  capabilities: string[];
  providerAccountReference?: string;
  providerMetadata?: Record<string, unknown>;
};

export type ProviderWebhookDelivery = {
  rawBody: string;
  headers: Record<string, string>;
  availableAt: string;
};

export type PaymentCommandResult = {
  status: PaymentCommandStatus;
  providerStatus: string;
  providerPaymentReference?: string;
  providerTransactionReference?: string;
  failureCategory?: string;
  failureCode?: string;
  failureMessage?: string;
  providerMetadata?: Record<string, unknown>;
  developmentWebhookDeliveries?: ProviderWebhookDelivery[];
};

export type RefundCommandResult = {
  status: "processing" | "unknown" | "failed";
  providerStatus: string;
  providerRefundReference?: string;
  failureCategory?: string;
  failureCode?: string;
  failureMessage?: string;
  providerMetadata?: Record<string, unknown>;
  reconciliationEvent?: NormalizedPaymentEvent;
  developmentWebhookDeliveries?: ProviderWebhookDelivery[];
};

export type NormalizedPaymentEvent = {
  eventId: string;
  kind: PaymentEventKind;
  occurredAt: string;
  availableAt: string;
  connectionId?: string;
  providerAccountReference?: string;
  providerLocationReference?: string;
  attemptId?: string;
  refundId?: string;
  amountCents?: number;
  currency?: string;
  providerPaymentReference?: string;
  providerTransactionReference?: string;
  providerRefundReference?: string;
  providerStatus: string;
  failureCategory?: string;
  failureCode?: string;
  failureMessage?: string;
};

export type VerifiedProviderWebhook = {
  eventId: string;
  environment: "test" | "sandbox" | "production";
  rawBody: string;
  payload: Record<string, unknown>;
  sanitizedPayload?: Record<string, unknown>;
};

export type PaymentStatus = {
  paymentId: string;
  orderId: string;
  connectionId: string;
  provider: string;
  providerEnvironment: "test" | "sandbox" | "production";
  status:
    | "requires_payment_method"
    | "processing"
    | "authorized"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "partially_refunded"
    | "refunded";
  orderStatus: "pending_payment" | "placed" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
  paymentStatus: "unpaid" | "pending" | "paid" | "failed" | "partially_refunded" | "refunded";
  captureMode: CaptureMode;
  amountCents: number;
  currency: string;
  paymentDueAt: string;
  paidAt: string | null;
  latestAttempt: {
    attemptId: string;
    status: "processing" | "authorized" | "succeeded" | "failed" | "cancelled" | "unknown";
    failureCategory: string | null;
    failureCode: string | null;
    failureMessage: string | null;
  } | null;
};
