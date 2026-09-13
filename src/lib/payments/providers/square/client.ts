import {
  Currency,
  SquareClient,
  SquareEnvironment,
  type Location,
  type Payment,
  type PaymentRefund,
} from "square";
import type { SquareSandboxConfig } from "./config";

export type SquareCreatePaymentRequest = {
  sourceId: string;
  idempotencyKey: string;
  amountCents: number;
  autocomplete: boolean;
  locationId: string;
  referenceId: string;
};

export type SquareCreateRefundRequest = {
  idempotencyKey: string;
  amountCents: number;
  paymentId: string;
  reason?: string;
};

export interface SquareGateway {
  createPayment(input: SquareCreatePaymentRequest): Promise<Payment>;
  getPayment(paymentId: string): Promise<Payment>;
  findPaymentByReference(input: {
    referenceId: string;
    locationId: string;
    amountCents: number;
    createdAt: string;
  }): Promise<Payment | undefined>;
  completePayment(paymentId: string): Promise<Payment>;
  cancelPayment(paymentId: string): Promise<Payment>;
  createRefund(input: SquareCreateRefundRequest): Promise<PaymentRefund>;
  getRefund(refundId: string): Promise<PaymentRefund>;
  getLocation(locationId: string): Promise<Location>;
}

function required<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

export class SquareSdkGateway implements SquareGateway {
  private readonly client: SquareClient;

  constructor(config: SquareSandboxConfig) {
    this.client = new SquareClient({
      token: config.accessToken,
      environment: SquareEnvironment.Sandbox,
      version: config.apiVersion,
      timeoutInSeconds: 12,
      maxRetries: 2,
    });
  }

  async createPayment(input: SquareCreatePaymentRequest) {
    const response = await this.client.payments.create({
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      amountMoney: { amount: BigInt(input.amountCents), currency: Currency.Usd },
      autocomplete: input.autocomplete,
      acceptPartialAuthorization: false,
      customerDetails: { customerInitiated: true, sellerKeyedIn: false },
      locationId: input.locationId,
      referenceId: input.referenceId,
    });
    return required(response.payment, "Square did not return a payment.");
  }

  async getPayment(paymentId: string) {
    const response = await this.client.payments.get({ paymentId });
    return required(response.payment, "Square did not return the requested payment.");
  }

  async findPaymentByReference(input: {
    referenceId: string;
    locationId: string;
    amountCents: number;
    createdAt: string;
  }) {
    const createdAt = Date.parse(input.createdAt);
    const beginTime = new Date(
      Number.isFinite(createdAt) ? Math.max(0, createdAt - 5 * 60_000) : Date.now() - 60 * 60_000,
    ).toISOString();
    let page = await this.client.payments.list({
      beginTime,
      sortOrder: "DESC",
      locationId: input.locationId,
      total: BigInt(input.amountCents),
      limit: 100,
    });
    for (let pageCount = 0; pageCount < 5; pageCount += 1) {
      const payment = page.data.find((candidate) => candidate.referenceId === input.referenceId);
      if (payment) return payment;
      if (!page.hasNextPage()) return undefined;
      page = await page.getNextPage();
    }
    return undefined;
  }

  async completePayment(paymentId: string) {
    const response = await this.client.payments.complete({ paymentId });
    return required(response.payment, "Square did not return the captured payment.");
  }

  async cancelPayment(paymentId: string) {
    const response = await this.client.payments.cancel({ paymentId });
    return required(response.payment, "Square did not return the cancelled payment.");
  }

  async createRefund(input: SquareCreateRefundRequest) {
    const response = await this.client.refunds.refundPayment({
      idempotencyKey: input.idempotencyKey,
      amountMoney: { amount: BigInt(input.amountCents), currency: Currency.Usd },
      paymentId: input.paymentId,
      reason: input.reason?.slice(0, 192),
    });
    return required(response.refund, "Square did not return a refund.");
  }

  async getRefund(refundId: string) {
    const response = await this.client.refunds.get({ refundId });
    return required(response.refund, "Square did not return the requested refund.");
  }

  async getLocation(locationId: string) {
    const response = await this.client.locations.get({ locationId });
    return required(response.location, "Square did not return the configured location.");
  }
}
