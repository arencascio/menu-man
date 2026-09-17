import type {
  AuthorizedPaymentActionInput,
  CreatePaymentInput,
  CreateRefundInput,
  PaymentProviderAdapter,
  RetrievePaymentInput,
  RetrieveRefundInput,
} from "../../adapter";
import type {
  BrowserPaymentSession,
  ConnectionSnapshot,
  OnboardingAction,
  PaymentCommandResult,
  PaymentConnectionContext,
  RefundCommandResult,
  VerifiedProviderWebhook,
} from "../../types";
import { SquareSdkGateway, type SquareGateway } from "./client";
import { SQUARE_SANDBOX_SCRIPT_URL, type SquareSandboxConfig } from "./config";
import {
  paymentCommandResult,
  paymentEvent,
  refundCommandResult,
  refundEvent,
  squareErrorResult,
  squareRefundErrorResult,
} from "./mappers";
import { normalizeSquareWebhook, verifySquareWebhook } from "./webhook";

export class SquarePaymentProviderAdapter implements PaymentProviderAdapter {
  readonly key = "square";
  private readonly gateway: SquareGateway;

  constructor(
    private readonly config: SquareSandboxConfig,
    gateway?: SquareGateway,
  ) {
    this.gateway = gateway || new SquareSdkGateway(config);
  }

  private assertSandbox(input: PaymentConnectionContext) {
    if (input.provider !== "square" || input.environment !== "sandbox") {
      throw new Error("The Square Sandbox adapter requires a sandbox Square connection.");
    }
  }

  async beginOnboarding(input: PaymentConnectionContext): Promise<OnboardingAction> {
    this.assertSandbox(input);
    return { mode: "complete", providerSessionReference: this.config.merchantId };
  }

  async refreshConnection(input: PaymentConnectionContext): Promise<ConnectionSnapshot> {
    this.assertSandbox(input);
    try {
      const location = await this.gateway.getLocation(this.config.locationId);
      const active = location.status === "ACTIVE"
        && location.country === "US"
        && location.currency === "USD"
        && location.merchantId === this.config.merchantId
        && location.capabilities?.includes("CREDIT_CARD_PROCESSING");
      return {
        status: active ? "active" : "restricted",
        capabilities: active ? ["accept_payments", "refunds", "manual_capture"] : [],
        providerAccountReference: location.merchantId,
        providerMetadata: {
          locationId: location.id,
          country: location.country,
          currency: location.currency,
          locationStatus: location.status,
        },
      };
    } catch {
      return { status: "error", capabilities: [] };
    }
  }

  async disconnect(input: PaymentConnectionContext): Promise<ConnectionSnapshot> {
    this.assertSandbox(input);
    return { status: "disconnected", capabilities: [] };
  }

  async createBrowserSession(input: PaymentConnectionContext): Promise<BrowserPaymentSession> {
    this.assertSandbox(input);
    return {
      mode: "embedded",
      provider: "square",
      publicConfig: {
        applicationId: this.config.applicationId,
        locationId: this.config.locationId,
        environment: "sandbox",
        scriptUrl: SQUARE_SANDBOX_SCRIPT_URL,
        cardsOnly: true,
      },
    };
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentCommandResult> {
    this.assertSandbox(input);
    if (input.currency !== "USD" || input.amountCents <= 0) {
      return {
        status: "failed",
        providerStatus: "UNSUPPORTED_PAYMENT",
        failureCategory: "provider_configuration",
        failureCode: "US_USD_ONLY",
        failureMessage: "The payment provider is not configured for this payment.",
      };
    }
    try {
      const payment = await this.gateway.createPayment({
        sourceId: input.paymentMethodToken,
        idempotencyKey: input.providerIdempotencyKey,
        amountCents: input.amountCents,
        autocomplete: input.captureMode === "automatic",
        locationId: this.config.locationId,
        referenceId: input.attemptId,
      });
      return paymentCommandResult(payment);
    } catch (error) {
      return squareErrorResult(error);
    }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<PaymentCommandResult & { reconciliationEvent?: import("../../types").NormalizedPaymentEvent }> {
    this.assertSandbox(input);
    try {
      const payment = input.providerPaymentReference
        ? await this.gateway.getPayment(input.providerPaymentReference)
        : await this.gateway.findPaymentByReference({
          referenceId: input.attemptId,
          locationId: this.config.locationId,
          amountCents: input.amountCents,
          createdAt: input.createdAt,
        });
      if (!payment) {
        return {
          status: "unknown",
          providerStatus: "PAYMENT_NOT_YET_DISCOVERABLE",
          failureCategory: "provider_unavailable",
        };
      }
      const result = paymentCommandResult(payment);
      return {
        ...result,
        reconciliationEvent: paymentEvent(payment, {
          eventId: `square_reconcile_payment_${payment.id}_${payment.updatedAt || payment.status}`,
          connectionId: input.connectionId,
          attemptId: input.attemptId,
          providerAccountReference: this.config.merchantId,
          providerLocationReference: this.config.locationId,
          providerPaymentReference: input.providerPaymentReference || payment.id,
        }),
      };
    } catch (error) {
      return squareErrorResult(error);
    }
  }

  async capturePayment(input: AuthorizedPaymentActionInput): Promise<PaymentCommandResult> {
    this.assertSandbox(input);
    try {
      return paymentCommandResult(await this.gateway.completePayment(input.providerPaymentReference));
    } catch (error) {
      return squareErrorResult(error);
    }
  }

  async cancelPayment(input: AuthorizedPaymentActionInput): Promise<PaymentCommandResult> {
    this.assertSandbox(input);
    try {
      return paymentCommandResult(await this.gateway.cancelPayment(input.providerPaymentReference));
    } catch (error) {
      return squareErrorResult(error);
    }
  }

  async createRefund(input: CreateRefundInput): Promise<RefundCommandResult> {
    this.assertSandbox(input);
    if (input.currency !== "USD" || input.amountCents <= 0) {
      return {
        status: "failed",
        providerStatus: "UNSUPPORTED_REFUND",
        failureCategory: "provider_configuration",
        failureCode: "US_USD_ONLY",
        failureMessage: "The payment provider is not configured for this refund.",
      };
    }
    try {
      const refund = await this.gateway.createRefund({
        idempotencyKey: input.providerIdempotencyKey,
        amountCents: input.amountCents,
        paymentId: input.providerPaymentReference,
        reason: `Menu Man refund ${input.refundId}`,
      });
      const result = refundCommandResult(refund);
      return {
        ...result,
        reconciliationEvent: refundEvent(refund, {
          eventId: `square_command_refund_${refund.id}_${refund.updatedAt || refund.status}`,
          connectionId: input.connectionId,
          refundId: input.refundId,
          providerAccountReference: this.config.merchantId,
          providerLocationReference: this.config.locationId,
          providerPaymentReference: input.providerPaymentReference,
        }),
      };
    } catch (error) {
      return squareRefundErrorResult(error);
    }
  }

  async retrieveRefund(input: RetrieveRefundInput): Promise<RefundCommandResult> {
    this.assertSandbox(input);
    try {
      const refund = await this.gateway.getRefund(input.providerRefundReference);
      const result = refundCommandResult(refund);
      return {
        ...result,
        reconciliationEvent: refundEvent(refund, {
          eventId: `square_reconcile_refund_${refund.id}_${refund.updatedAt || refund.status}`,
          connectionId: input.connectionId,
          refundId: input.refundId,
          providerAccountReference: this.config.merchantId,
          providerLocationReference: this.config.locationId,
        }),
      };
    } catch (error) {
      return squareRefundErrorResult(error);
    }
  }

  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedProviderWebhook> {
    return verifySquareWebhook(rawBody, headers, this.config);
  }

  normalizeWebhook(webhook: VerifiedProviderWebhook) {
    return normalizeSquareWebhook(webhook, this.config);
  }
}
