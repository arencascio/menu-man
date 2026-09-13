import { WebhooksHelper, type Payment, type PaymentRefund } from "square";
import type { NormalizedPaymentEvent, VerifiedProviderWebhook } from "../../types";
import type { SquareSandboxConfig } from "./config";
import { paymentEvent, refundEvent } from "./mappers";

type JsonObject = Record<string, unknown>;

export class InvalidSquareWebhookError extends Error {}

function object(value: unknown): JsonObject | undefined {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function string(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? BigInt(value) : undefined;
}

function money(value: unknown) {
  const record = object(value);
  if (!record) return undefined;
  const amount = number(record.amount);
  const currency = string(record.currency);
  return amount == null || !currency ? undefined : { amount, currency: currency as "USD" };
}

function paymentFromPayload(value: unknown): Payment | undefined {
  const record = object(value);
  if (!record) return undefined;
  return {
    id: string(record.id),
    status: string(record.status),
    createdAt: string(record.created_at),
    updatedAt: string(record.updated_at),
    amountMoney: money(record.amount_money),
    totalMoney: money(record.total_money),
    locationId: string(record.location_id),
    referenceId: string(record.reference_id),
    applicationDetails: object(record.application_details) ? {
      applicationId: string(object(record.application_details)?.application_id),
    } : undefined,
  };
}

function refundFromPayload(value: unknown): PaymentRefund | undefined {
  const record = object(value);
  const amountMoney = money(record?.amount_money);
  const id = string(record?.id);
  if (!record || !amountMoney || !id) return undefined;
  return {
    id,
    status: string(record.status),
    createdAt: string(record.created_at),
    updatedAt: string(record.updated_at),
    locationId: string(record.location_id),
    paymentId: string(record.payment_id),
    amountMoney,
  };
}

function safePayment(payment: Payment) {
  return {
    id: payment.id,
    status: payment.status,
    created_at: payment.createdAt,
    updated_at: payment.updatedAt,
    location_id: payment.locationId,
    reference_id: payment.referenceId,
    amount_money: payment.amountMoney && {
      amount: payment.amountMoney.amount == null ? undefined : Number(payment.amountMoney.amount),
      currency: payment.amountMoney.currency,
    },
    total_money: payment.totalMoney && {
      amount: payment.totalMoney.amount == null ? undefined : Number(payment.totalMoney.amount),
      currency: payment.totalMoney.currency,
    },
  };
}

function safeRefund(refund: PaymentRefund) {
  return {
    id: refund.id,
    status: refund.status,
    created_at: refund.createdAt,
    updated_at: refund.updatedAt,
    location_id: refund.locationId,
    payment_id: refund.paymentId,
    amount_money: {
      amount: refund.amountMoney.amount == null ? undefined : Number(refund.amountMoney.amount),
      currency: refund.amountMoney.currency,
    },
  };
}

export async function verifySquareWebhook(
  rawBody: string,
  headers: Headers,
  config: SquareSandboxConfig,
): Promise<VerifiedProviderWebhook> {
  const signature = headers.get("x-square-hmacsha256-signature") || "";
  let valid = false;
  try {
    valid = await WebhooksHelper.verifySignature({
      requestBody: rawBody,
      signatureHeader: signature,
      signatureKey: config.webhookSignatureKey,
      notificationUrl: config.webhookNotificationUrl,
    });
  } catch {
    // Missing or malformed signatures are handled identically to mismatches.
  }
  if (!valid) throw new InvalidSquareWebhookError("Square webhook signature is invalid.");
  let payload: JsonObject;
  try {
    payload = JSON.parse(rawBody) as JsonObject;
  } catch {
    throw new InvalidSquareWebhookError("Square webhook body is invalid.");
  }
  const eventId = string(payload.event_id);
  if (!eventId) throw new InvalidSquareWebhookError("Square webhook event ID is missing.");
  return { eventId, environment: "sandbox", rawBody, payload };
}

export function normalizeSquareWebhook(
  webhook: VerifiedProviderWebhook,
  config: SquareSandboxConfig,
): NormalizedPaymentEvent[] {
  const payload = webhook.payload;
  const merchantId = string(payload.merchant_id);
  const type = string(payload.type);
  const createdAt = string(payload.created_at) || new Date().toISOString();
  if (merchantId !== config.merchantId) return [];
  const eventObject = object(object(object(payload.data)?.object));
  if (!eventObject || !type) return [];

  if (type === "payment.created" || type === "payment.updated") {
    const payment = paymentFromPayload(eventObject.payment);
    if (!payment || payment.locationId !== config.locationId || !payment.referenceId) return [];
    if (payment.applicationDetails?.applicationId && payment.applicationDetails.applicationId !== config.applicationId) return [];
    const event = paymentEvent(payment, {
      eventId: webhook.eventId,
      attemptId: payment.referenceId,
      providerAccountReference: merchantId,
      providerLocationReference: payment.locationId,
    });
    if (!event) return [];
    webhook.sanitizedPayload = {
      event_id: webhook.eventId,
      type,
      merchant_id: merchantId,
      created_at: createdAt,
      data: { object: { payment: safePayment(payment) } },
    };
    return [{ ...event, occurredAt: payment.updatedAt || createdAt }];
  }

  if (type === "refund.created" || type === "refund.updated") {
    const refund = refundFromPayload(eventObject.refund);
    if (!refund || refund.locationId !== config.locationId || !refund.paymentId) return [];
    const event = refundEvent(refund, {
      eventId: webhook.eventId,
      providerAccountReference: merchantId,
      providerLocationReference: refund.locationId || undefined,
      providerPaymentReference: refund.paymentId,
    });
    if (!event) return [];
    webhook.sanitizedPayload = {
      event_id: webhook.eventId,
      type,
      merchant_id: merchantId,
      created_at: createdAt,
      data: { object: { refund: safeRefund(refund) } },
    };
    return [{ ...event, occurredAt: refund.updatedAt || createdAt }];
  }

  return [];
}
