import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { supabaseServer } from "@/lib/supabase/server";
import {
  paymentSessionResponseSchema,
  paymentStatusSchema,
  preparedPaymentSchema,
  reservedAttemptSchema,
  type PaymentSessionResponse,
} from "./contracts";
import { getPaymentProvider } from "./registry";
import { FakePaymentProviderAdapter } from "./providers/fake/adapter";
import { isFakePaymentRecoveryRuntimeEnabled, isFakePaymentRuntimeEnabled } from "./runtime";
import { shouldExpirePaymentOnStatusRead } from "./state";
import { orderPaymentViewSchema } from "./view-contracts";
import type {
  NormalizedPaymentEvent,
  PaymentCommandResult,
  PaymentConnectionContext,
  PaymentStatus,
  ProviderWebhookDelivery,
} from "./types";

export type PaymentErrorCode =
  | "INVALID_PAYMENT_SESSION"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_PROVIDER_UNAVAILABLE"
  | "PAYMENT_NOT_ALLOWED"
  | "PAYMENT_EXPIRED"
  | "PAYMENT_IN_PROGRESS"
  | "INVALID_PAYMENT_EVENT"
  | "REFUND_NOT_ALLOWED"
  | "PAYMENT_FAILED";

const knownCodes = new Set<PaymentErrorCode>([
  "INVALID_PAYMENT_SESSION",
  "PAYMENT_NOT_FOUND",
  "PAYMENT_PROVIDER_UNAVAILABLE",
  "PAYMENT_NOT_ALLOWED",
  "PAYMENT_EXPIRED",
  "PAYMENT_IN_PROGRESS",
  "INVALID_PAYMENT_EVENT",
  "REFUND_NOT_ALLOWED",
  "PAYMENT_FAILED",
]);

export class PaymentServerError extends Error {
  constructor(public readonly code: PaymentErrorCode, message: string) {
    super(message);
  }
}

function parseDatabaseError(message: string) {
  const match = message.match(/MM_([A-Z_]+)\|([^\n]*)/);
  const code = match?.[1] as PaymentErrorCode | undefined;
  if (code && knownCodes.has(code)) {
    return new PaymentServerError(code, match?.[2] || "Payment could not be completed.");
  }
  return new PaymentServerError("PAYMENT_FAILED", "Payment could not be completed.");
}

function tokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function connectionFromStatus(status: PaymentStatus): PaymentConnectionContext {
  return {
    connectionId: status.connectionId,
    provider: status.provider,
    environment: status.providerEnvironment,
  };
}

function parsePaymentStatus(data: unknown) {
  const parsed = paymentStatusSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Invalid payment status response.", parsed.error);
    throw new PaymentServerError("PAYMENT_FAILED", "Payment status could not be loaded.");
  }
  return parsed.data;
}

export async function preparePaymentForOrder(
  orderId: string,
): Promise<(PaymentSessionResponse & { checkoutToken: string }) | null> {
  const checkoutToken = randomBytes(32).toString("base64url");
  const { data, error } = await supabaseServer.rpc("prepare_payment_v1", {
    p_order_id: orderId,
    p_access_token_hash: tokenHash(checkoutToken),
    p_allow_fake: isFakePaymentRuntimeEnabled(),
    p_payment_ttl_minutes: 30,
    p_session_ttl_minutes: 120,
  });

  if (error) {
    const parsedError = parseDatabaseError(error.message);
    if (parsedError.code === "PAYMENT_PROVIDER_UNAVAILABLE") return null;
    throw parsedError;
  }

  const parsed = preparedPaymentSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Invalid prepared payment response.", parsed.error);
    throw new PaymentServerError("PAYMENT_FAILED", "Payment could not be prepared.");
  }

  const { sessionExpiresAt, ...payment } = parsed.data;
  const adapter = getPaymentProvider(payment.provider);
  const browserSession = await adapter.createBrowserSession(connectionFromStatus(payment));
  const publicSession = paymentSessionResponseSchema.parse({
    expiresAt: sessionExpiresAt,
    payment,
    browserSession,
  });
  return Object.assign(publicSession, { checkoutToken });
}

export async function getPaymentSession(orderId: string, checkoutToken: string) {
  const status = await getPaymentStatus(orderId, checkoutToken);
  const adapter = getPaymentProvider(status.provider);
  const browserSession = await adapter.createBrowserSession(connectionFromStatus(status));
  return { payment: status, browserSession };
}

async function authorizePaymentStatus(orderId: string, checkoutToken: string) {
  const { data, error } = await supabaseServer.rpc("authorize_payment_session_v1", {
    p_order_id: orderId,
    p_access_token_hash: tokenHash(checkoutToken),
  });
  if (error) throw parseDatabaseError(error.message);
  return parsePaymentStatus(data);
}

export async function getOrderPaymentView(
  restaurantSlug: string,
  orderId: string,
  checkoutToken: string,
) {
  const { data, error } = await supabaseServer.rpc("get_order_payment_view_v1", {
    p_order_id: orderId,
    p_restaurant_slug: restaurantSlug,
    p_access_token_hash: tokenHash(checkoutToken),
  });
  if (error) throw parseDatabaseError(error.message);
  const parsed = orderPaymentViewSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Invalid order payment view response.", parsed.error);
    throw new PaymentServerError("PAYMENT_FAILED", "Order payment details could not be loaded.");
  }
  return parsed.data;
}

async function recordCommandResult(attemptId: string, result: PaymentCommandResult) {
  const { error } = await supabaseServer.rpc("record_payment_command_result_v1", {
    p_attempt_id: attemptId,
    p_status: result.status,
    p_provider_payment_reference: result.providerPaymentReference || null,
    p_provider_transaction_reference: result.providerTransactionReference || null,
    p_provider_status: result.providerStatus,
    p_failure_category: result.failureCategory || null,
    p_failure_code: result.failureCode || null,
    p_failure_message: result.failureMessage || null,
    p_provider_metadata: result.providerMetadata || {},
  });
  if (error) throw parseDatabaseError(error.message);
}

async function enqueueDevelopmentDeliveries(
  providerKey: string,
  deliveries: ProviderWebhookDelivery[] | undefined,
) {
  if (!deliveries?.length) return;
  if (providerKey !== "fake" || !isFakePaymentRuntimeEnabled()) {
    throw new PaymentServerError("PAYMENT_PROVIDER_UNAVAILABLE", "Development webhooks are disabled.");
  }
  for (const delivery of deliveries) {
    await acceptPaymentWebhook(providerKey, delivery.rawBody, new Headers(delivery.headers));
    await processDuePaymentEvents(providerKey);
  }
}

export async function submitPayment(
  orderId: string,
  checkoutToken: string,
  clientAttemptKey: string,
  paymentMethodToken: string,
) {
  const authorizedStatus = await authorizePaymentStatus(orderId, checkoutToken);
  const adapter = getPaymentProvider(authorizedStatus.provider);
  const { data, error } = await supabaseServer.rpc("reserve_payment_attempt_v1", {
    p_order_id: orderId,
    p_access_token_hash: tokenHash(checkoutToken),
    p_client_attempt_key: clientAttemptKey,
  });
  if (error) throw parseDatabaseError(error.message);

  const parsed = reservedAttemptSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Invalid reserved payment attempt.", parsed.error);
    throw new PaymentServerError("PAYMENT_FAILED", "Payment attempt could not be created.");
  }
  const attempt = parsed.data;
  if (attempt.connectionId !== authorizedStatus.connectionId || attempt.provider !== authorizedStatus.provider) {
    throw new PaymentServerError("PAYMENT_FAILED", "Payment connection changed unexpectedly.");
  }

  let result: PaymentCommandResult;
  try {
    result = await adapter.createPayment({
      connectionId: attempt.connectionId,
      provider: attempt.provider,
      environment: attempt.providerEnvironment,
      attemptId: attempt.attemptId,
      paymentId: attempt.paymentId,
      orderId,
      providerIdempotencyKey: attempt.providerIdempotencyKey,
      paymentMethodToken,
      amountCents: attempt.amountCents,
      currency: attempt.currency,
      captureMode: attempt.captureMode,
    });
  } catch {
    result = {
      status: "unknown",
      providerStatus: "REQUEST_OUTCOME_UNKNOWN",
      failureCategory: "provider_unavailable",
    };
  }

  await recordCommandResult(attempt.attemptId, result);
  await enqueueDevelopmentDeliveries(attempt.provider, result.developmentWebhookDeliveries);
  await processDuePaymentEvents(attempt.provider);

  let status = await authorizePaymentStatus(orderId, checkoutToken);

  if (attempt.provider === "fake" && result.providerMetadata?.fakeScenario === "refund" && status.status === "succeeded") {
    status = await runFakeFullRefund(status, checkoutToken, result.providerPaymentReference || "");
  }

  return status;
}

async function runFakeFullRefund(
  status: PaymentStatus,
  checkoutToken: string,
  providerPaymentReference: string,
) {
  const idempotencyKey = randomUUID();
  const { data, error } = await supabaseServer.rpc("reserve_refund_v1", {
    p_payment_id: status.paymentId,
    p_idempotency_key: idempotencyKey,
    p_amount_cents: status.amountCents,
    p_reason: "Fake provider deterministic refund scenario",
    p_requested_by: "fake_provider",
  });
  if (error) throw parseDatabaseError(error.message);

  const refund = data as {
    refundId: string;
    paymentId: string;
    connectionId: string;
    amountCents: number;
    currency: string;
    providerIdempotencyKey: string;
  };
  const adapter = getPaymentProvider("fake");
  const result = await adapter.createRefund({
    ...connectionFromStatus(status),
    refundId: refund.refundId,
    paymentId: refund.paymentId,
    providerIdempotencyKey: refund.providerIdempotencyKey,
    providerPaymentReference,
    amountCents: refund.amountCents,
    currency: refund.currency,
  });
  await enqueueDevelopmentDeliveries("fake", result.developmentWebhookDeliveries);
  await processDuePaymentEvents("fake");
  return authorizePaymentStatus(status.orderId, checkoutToken);
}

export async function getPaymentStatus(orderId: string, checkoutToken: string) {
  let status = await authorizePaymentStatus(orderId, checkoutToken);
  if (status.provider === "fake") {
    if (!isFakePaymentRuntimeEnabled()) {
      throw new PaymentServerError("PAYMENT_PROVIDER_UNAVAILABLE", "The fake payment provider is disabled.");
    }
    await processDuePaymentEvents("fake");
    status = await authorizePaymentStatus(orderId, checkoutToken);
  }
  if (shouldExpirePaymentOnStatusRead(status)) {
    const { data, error } = await supabaseServer.rpc("expire_payment_v1", {
      p_payment_id: status.paymentId,
    });
    if (error) throw parseDatabaseError(error.message);
    status = parsePaymentStatus(data);
  }
  return status;
}

export async function resolveFakeUnknownPayment(
  orderId: string,
  checkoutToken: string,
  resolution: "succeeded" | "failed",
) {
  if (!isFakePaymentRecoveryRuntimeEnabled()) {
    throw new PaymentServerError("PAYMENT_PROVIDER_UNAVAILABLE", "Fake payment recovery is disabled.");
  }

  const status = await authorizePaymentStatus(orderId, checkoutToken);
  if (
    status.provider !== "fake"
    || status.providerEnvironment !== "test"
    || status.orderStatus !== "pending_payment"
    || status.status !== "processing"
    || status.latestAttempt?.status !== "unknown"
  ) {
    throw new PaymentServerError("PAYMENT_NOT_ALLOWED", "This payment is not awaiting fake-provider reconciliation.");
  }

  const adapter = getPaymentProvider("fake");
  if (!(adapter instanceof FakePaymentProviderAdapter)) {
    throw new PaymentServerError("PAYMENT_PROVIDER_UNAVAILABLE", "Fake payment recovery is disabled.");
  }

  const delivery = adapter.createUnknownPaymentResolution({
    ...connectionFromStatus(status),
    attemptId: status.latestAttempt.attemptId,
    amountCents: status.amountCents,
    currency: status.currency,
    resolution,
  });
  await enqueueDevelopmentDeliveries("fake", [delivery]);
  await processDuePaymentEvents("fake");
  return authorizePaymentStatus(orderId, checkoutToken);
}

export async function acceptPaymentWebhook(providerKey: string, rawBody: string, headers: Headers) {
  const adapter = getPaymentProvider(providerKey);
  const verified = adapter.verifyWebhook(rawBody, headers);
  const events = adapter.normalizeWebhook(verified);
  const payloadHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  const rawPayload = JSON.parse(rawBody) as Record<string, unknown>;
  const accepted: Array<{ webhookEventId: string; inserted: boolean }> = [];

  for (const event of events) {
    const { data, error } = await supabaseServer.rpc("ingest_payment_webhook_v1", {
      p_provider_key: providerKey,
      p_environment: verified.environment,
      p_provider_event_id: event.eventId,
      p_connection_id: event.connectionId,
      p_payload_sha256: payloadHash,
      p_raw_payload: rawPayload,
      p_normalized_event: normalizedEventPayload(event),
      p_occurred_at: event.occurredAt,
      p_available_at: event.availableAt,
    });
    if (error) throw parseDatabaseError(error.message);
    accepted.push(data as { webhookEventId: string; inserted: boolean });
  }
  return accepted;
}

function normalizedEventPayload(event: NormalizedPaymentEvent) {
  return Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined));
}

export async function processDuePaymentEvents(providerKey: string) {
  if (providerKey === "fake" && !isFakePaymentRuntimeEnabled()) {
    throw new PaymentServerError("PAYMENT_PROVIDER_UNAVAILABLE", "The fake payment provider is disabled.");
  }
  const { data, error } = await supabaseServer.rpc("list_due_payment_webhooks_v1", {
    p_provider_key: providerKey,
    p_limit: 25,
  });
  if (error) throw parseDatabaseError(error.message);

  for (const row of (data || []) as Array<{ webhook_event_id: string }>) {
    const result = await supabaseServer.rpc("apply_payment_event_v1", {
      p_webhook_event_id: row.webhook_event_id,
    });
    if (result.error) {
      console.error("Payment event processing failed.", row.webhook_event_id, result.error.message);
    }
  }
}
