import type {
  BrowserPaymentSession,
  ConnectionSnapshot,
  NormalizedPaymentEvent,
  PaymentCommandResult,
  PaymentConnectionContext,
  OnboardingAction,
  RefundCommandResult,
  VerifiedProviderWebhook,
} from "./types";

export type CreatePaymentInput = PaymentConnectionContext & {
  attemptId: string;
  paymentId: string;
  orderId: string;
  providerIdempotencyKey: string;
  paymentMethodToken: string;
  amountCents: number;
  currency: string;
  captureMode: "automatic" | "manual";
};

export type CreateRefundInput = PaymentConnectionContext & {
  refundId: string;
  paymentId: string;
  providerIdempotencyKey: string;
  providerPaymentReference: string;
  amountCents: number;
  currency: string;
};

export type AuthorizedPaymentActionInput = PaymentConnectionContext & {
  attemptId: string;
  paymentId: string;
  orderId: string;
  providerIdempotencyKey: string;
  providerPaymentReference: string;
  amountCents: number;
  currency: string;
};

export interface PaymentProviderAdapter {
  readonly key: string;
  beginOnboarding(input: PaymentConnectionContext): Promise<OnboardingAction>;
  refreshConnection(input: PaymentConnectionContext): Promise<ConnectionSnapshot>;
  disconnect(input: PaymentConnectionContext): Promise<ConnectionSnapshot>;
  createBrowserSession(input: PaymentConnectionContext): Promise<BrowserPaymentSession>;
  createPayment(input: CreatePaymentInput): Promise<PaymentCommandResult>;
  retrievePayment(input: PaymentConnectionContext & { providerPaymentReference: string }): Promise<PaymentCommandResult>;
  capturePayment(input: AuthorizedPaymentActionInput): Promise<PaymentCommandResult>;
  cancelPayment(input: AuthorizedPaymentActionInput): Promise<PaymentCommandResult>;
  createRefund(input: CreateRefundInput): Promise<RefundCommandResult>;
  retrieveRefund(input: PaymentConnectionContext & { providerRefundReference: string }): Promise<RefundCommandResult>;
  verifyWebhook(rawBody: string, headers: Headers): VerifiedProviderWebhook;
  normalizeWebhook(webhook: VerifiedProviderWebhook): NormalizedPaymentEvent[];
}
