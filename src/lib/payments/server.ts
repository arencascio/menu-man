import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { supabaseServer } from "@/lib/supabase/server";
import {
  checkoutAbandonmentResponseSchema,
  paymentSessionResponseSchema,
  paymentStatusSchema,
  preparedPaymentSchema,
  reservedAuthorizationActionSchema,
  reservedAttemptSchema,
  reservedLateSuccessResolutionSchema,
  type PaymentSessionResponse,
} from "./contracts";
import { getPaymentProvider } from "./registry";
import { FakePaymentProviderAdapter } from "./providers/fake/adapter";
import {
  isFakePaymentRecoveryRuntimeEnabled,
  isFakePaymentRuntimeEnabled,
  isSquareSandboxRuntimeEnabled,
} from "./runtime";
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

export async function abandonCheckout(orderId: string, checkoutToken: string) {
  const { data, error } = await supabaseServer.rpc("abandon_checkout_v1", {
    p_order_id: orderId,
    p_access_token_hash: tokenHash(checkoutToken),
  });
  if (error) throw parseDatabaseError(error.message);
  const parsed = checkoutAbandonmentResponseSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Invalid checkout abandonment response.", parsed.error);
    throw new PaymentServerError("PAYMENT_FAILED", "Checkout could not be abandoned.");
  }
  return parsed.data;
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

async function recordRefundCommandResult(refundId: string, result: {
  status: "processing" | "unknown" | "failed";
  providerStatus: string;
  providerRefundReference?: string;
  failureCategory?: string;
  failureCode?: string;
  failureMessage?: string;
  providerMetadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseServer.rpc("record_refund_command_result_v1", {
    p_refund_id: refundId,
    p_status: result.status,
    p_provider_refund_reference: result.providerRefundReference || null,
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
  await recordRefundCommandResult(refund.refundId, result);
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
  } else if (status.provider === "square" && !isSquareSandboxRuntimeEnabled()) {
    throw new PaymentServerError("PAYMENT_PROVIDER_UNAVAILABLE", "The Square Sandbox payment provider is disabled.");
  }
  await processDuePaymentEvents(status.provider);
  status = await authorizePaymentStatus(orderId, checkoutToken);
  status = await reconcilePaymentIfDue(status, checkoutToken);
  if (shouldExpirePaymentOnStatusRead(status)) {
    const { data, error } = await supabaseServer.rpc("expire_payment_v1", {
      p_payment_id: status.paymentId,
    });
    if (error) throw parseDatabaseError(error.message);
    status = parsePaymentStatus(data);
  }
  return status;
}

async function reconcilePaymentIfDue(status: PaymentStatus, checkoutToken: string) {
  const attempt = status.latestAttempt;
  if (
    status.provider !== "square"
    || !attempt
    || !["processing", "unknown", "authorized"].includes(attempt.status)
  ) return status;

  const { data, error } = await supabaseServer
    .from("payment_attempts")
    .select("provider_payment_reference,last_provider_sync_at,amount_cents,currency,created_at")
    .eq("id", attempt.attemptId)
    .eq("connection_id", status.connectionId)
    .maybeSingle();
  if (error || !data) return status;
  if (data.last_provider_sync_at && Date.now() - Date.parse(data.last_provider_sync_at) < 10_000) return status;

  const adapter = getPaymentProvider(status.provider);
  const result = await adapter.retrievePayment({
    ...connectionFromStatus(status),
    attemptId: attempt.attemptId,
    paymentId: status.paymentId,
    orderId: status.orderId,
    providerPaymentReference: data.provider_payment_reference,
    createdAt: data.created_at,
    amountCents: data.amount_cents,
    currency: data.currency,
  });
  if (!result.reconciliationEvent) {
    const touched = await supabaseServer.rpc("touch_payment_reconciliation_v1", {
      p_attempt_id: attempt.attemptId,
      p_provider_status: result.providerStatus,
    });
    if (touched.error) throw parseDatabaseError(touched.error.message);
    return status;
  }
  await applyPaymentReconciliation(result.reconciliationEvent, "square", "sandbox");
  return authorizePaymentStatus(status.orderId, checkoutToken);
}

async function applyPaymentReconciliation(
  event: NormalizedPaymentEvent,
  providerKey: string,
  environment: "test" | "sandbox" | "production",
) {
  if (!event.connectionId) {
    throw new PaymentServerError("INVALID_PAYMENT_EVENT", "Reconciliation event has no payment connection.");
  }
  const { error } = await supabaseServer.rpc("ingest_payment_reconciliation_v1", {
    p_provider_key: providerKey,
    p_environment: environment,
    p_provider_event_id: event.eventId,
    p_connection_id: event.connectionId,
    p_normalized_event: normalizedEventPayload(event),
    p_occurred_at: event.occurredAt,
  });
  if (error) throw parseDatabaseError(error.message);
}

export type ReservedRefundCommand = {
  refundId: string;
  paymentId: string;
  connectionId: string;
  provider: string;
  providerEnvironment: "test" | "sandbox" | "production";
  providerIdempotencyKey: string;
  providerPaymentReference: string;
  amountCents: number;
  currency: string;
  status: "requested" | "processing" | "unknown" | "succeeded" | "failed" | "cancelled";
  replayed: boolean;
};

export async function executeReservedRefund(refund: ReservedRefundCommand) {
  if (["succeeded", "failed", "cancelled"].includes(refund.status)) {
    return { refundId: refund.refundId, status: refund.status, replayed: refund.replayed };
  }

  let result: import("./types").RefundCommandResult;
  try {
    const adapter = getPaymentProvider(refund.provider);
    result = await adapter.createRefund({
      connectionId: refund.connectionId,
      provider: refund.provider,
      environment: refund.providerEnvironment,
      refundId: refund.refundId,
      paymentId: refund.paymentId,
      providerIdempotencyKey: refund.providerIdempotencyKey,
      providerPaymentReference: refund.providerPaymentReference,
      amountCents: refund.amountCents,
      currency: refund.currency,
    });
  } catch {
    result = {
      status: "unknown" as const,
      providerStatus: "REQUEST_OUTCOME_UNKNOWN",
      failureCategory: "provider_unavailable",
    };
  }

  await recordRefundCommandResult(refund.refundId, result);
  await enqueueDevelopmentDeliveries(refund.provider, result.developmentWebhookDeliveries);
  if (result.reconciliationEvent) {
    await applyPaymentReconciliation(
      result.reconciliationEvent,
      refund.provider,
      refund.providerEnvironment,
    );
  }
  await processDuePaymentEvents(refund.provider);
  return {
    refundId: refund.refundId,
    status: result.reconciliationEvent?.kind === "refund.succeeded"
      ? "succeeded" as const
      : result.status,
    replayed: refund.replayed,
  };
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

export async function resolveFakeAuthorizationAction(
  orderId: string,
  checkoutToken: string,
  action: "capture" | "void",
  clientActionKey: string,
) {
  if (!isFakePaymentRecoveryRuntimeEnabled()) {
    throw new PaymentServerError("PAYMENT_PROVIDER_UNAVAILABLE", "Fake authorization controls are disabled.");
  }

  const { data, error } = await supabaseServer.rpc("reserve_fake_authorization_action_v1", {
    p_order_id: orderId,
    p_access_token_hash: tokenHash(checkoutToken),
    p_action: action,
    p_client_action_key: clientActionKey,
  });
  if (error) throw parseDatabaseError(error.message);
  const reservation = reservedAuthorizationActionSchema.safeParse(data);
  if (!reservation.success) {
    console.error("Invalid fake authorization reservation.", reservation.error);
    throw new PaymentServerError("PAYMENT_FAILED", "The authorization could not be updated.");
  }

  if (reservation.data.attemptStatus !== "authorized") {
    return authorizePaymentStatus(orderId, checkoutToken);
  }

  const adapter = getPaymentProvider("fake");
  const providerInput = {
    connectionId: reservation.data.connectionId,
    provider: reservation.data.provider,
    environment: reservation.data.providerEnvironment,
    attemptId: reservation.data.attemptId,
    paymentId: reservation.data.paymentId,
    orderId: reservation.data.orderId,
    providerIdempotencyKey: reservation.data.providerIdempotencyKey,
    providerPaymentReference: reservation.data.providerPaymentReference,
    amountCents: reservation.data.amountCents,
    currency: reservation.data.currency,
  };
  const result = action === "capture"
    ? await adapter.capturePayment(providerInput)
    : await adapter.cancelPayment(providerInput);
  await enqueueDevelopmentDeliveries("fake", result.developmentWebhookDeliveries);
  await processDuePaymentEvents("fake");
  return authorizePaymentStatus(orderId, checkoutToken);
}

export async function resolveFakeLateSuccess(
  orderId: string,
  checkoutToken: string,
  resolution: "accepted" | "refunded",
  clientActionKey: string,
) {
  if (!isFakePaymentRecoveryRuntimeEnabled()) {
    throw new PaymentServerError("PAYMENT_PROVIDER_UNAVAILABLE", "Fake late-success controls are disabled.");
  }

  const { data, error } = await supabaseServer.rpc("reserve_fake_late_success_resolution_v1", {
    p_order_id: orderId,
    p_access_token_hash: tokenHash(checkoutToken),
    p_resolution: resolution,
    p_client_action_key: clientActionKey,
  });
  if (error) throw parseDatabaseError(error.message);
  const reservation = reservedLateSuccessResolutionSchema.safeParse(data);
  if (!reservation.success) {
    console.error("Invalid fake late-success reservation.", reservation.error);
    throw new PaymentServerError("PAYMENT_FAILED", "The payment could not be resolved.");
  }

  if (resolution === "accepted") {
    const accepted = await supabaseServer.rpc("accept_fake_late_success_v1", {
      p_order_id: orderId,
      p_access_token_hash: tokenHash(checkoutToken),
    });
    if (accepted.error) throw parseDatabaseError(accepted.error.message);
    return parsePaymentStatus(accepted.data);
  }

  const currentStatus = await authorizePaymentStatus(orderId, checkoutToken);
  if (currentStatus.status === "refunded") return currentStatus;
  const reservedRefund = await supabaseServer.rpc("reserve_refund_v1", {
    p_payment_id: reservation.data.paymentId,
    p_idempotency_key: reservation.data.resolutionKey,
    p_amount_cents: reservation.data.amountCents,
    p_reason: "Fake late-success resolution",
    p_requested_by: "fake_provider_reconciliation",
  });
  if (reservedRefund.error) throw parseDatabaseError(reservedRefund.error.message);
  const refund = reservedRefund.data as {
    refundId: string;
    paymentId: string;
    connectionId: string;
    amountCents: number;
    currency: string;
    providerIdempotencyKey: string;
    status: string;
  };
  if (refund.status !== "succeeded") {
    const adapter = getPaymentProvider("fake");
    const result = await adapter.createRefund({
      connectionId: reservation.data.connectionId,
      provider: reservation.data.provider,
      environment: reservation.data.providerEnvironment,
      refundId: refund.refundId,
      paymentId: refund.paymentId,
      providerIdempotencyKey: refund.providerIdempotencyKey,
      providerPaymentReference: reservation.data.providerPaymentReference,
      amountCents: refund.amountCents,
      currency: refund.currency,
    });
    await recordRefundCommandResult(refund.refundId, result);
    await enqueueDevelopmentDeliveries("fake", result.developmentWebhookDeliveries);
    await processDuePaymentEvents("fake");
  }
  return authorizePaymentStatus(orderId, checkoutToken);
}

export async function acceptPaymentWebhook(providerKey: string, rawBody: string, headers: Headers) {
  const adapter = getPaymentProvider(providerKey);
  const verified = await adapter.verifyWebhook(rawBody, headers);
  const events = adapter.normalizeWebhook(verified);
  const payloadHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  const persistedPayload = verified.sanitizedPayload || verified.payload;
  const accepted: Array<{ webhookEventId?: string; providerEventId?: string; inserted: boolean; ignored?: boolean }> = [];

  for (const event of events) {
    const resolved = await resolveWebhookEvent(providerKey, verified.environment, event);
    if (!resolved) {
      accepted.push({ providerEventId: event.eventId, inserted: false, ignored: true });
      continue;
    }
    const { data, error } = await supabaseServer.rpc("ingest_payment_webhook_v1", {
      p_provider_key: providerKey,
      p_environment: verified.environment,
      p_provider_event_id: event.eventId,
      p_connection_id: resolved.connectionId,
      p_payload_sha256: payloadHash,
      p_raw_payload: persistedPayload,
      p_normalized_event: normalizedEventPayload(resolved),
      p_occurred_at: resolved.occurredAt,
      p_available_at: resolved.availableAt,
    });
    if (error) throw parseDatabaseError(error.message);
    accepted.push(data as { webhookEventId: string; inserted: boolean });
  }
  return accepted;
}

async function resolveWebhookEvent(
  providerKey: string,
  environment: "test" | "sandbox" | "production",
  event: NormalizedPaymentEvent,
): Promise<NormalizedPaymentEvent | null> {
  if (event.connectionId) return event;
  if (!event.providerAccountReference || !event.providerLocationReference) return null;

  const reference = await supabaseServer
    .from("payment_provider_references")
    .select("connection_id")
    .eq("provider_key", providerKey)
    .eq("environment", environment)
    .eq("reference_kind", "location")
    .eq("external_id", event.providerLocationReference)
    .maybeSingle();
  if (reference.error || !reference.data) return null;
  const connectionId = reference.data.connection_id;
  const connection = await supabaseServer
    .from("restaurant_payment_connections")
    .select("id")
    .eq("id", connectionId)
    .eq("provider_key", providerKey)
    .eq("environment", environment)
    .eq("provider_account_reference", event.providerAccountReference)
    .maybeSingle();
  if (connection.error || !connection.data) return null;

  if (event.kind.startsWith("payment.")) {
    if (!event.attemptId || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(event.attemptId)) return null;
    const attempt = await supabaseServer
      .from("payment_attempts")
      .select("provider_payment_reference")
      .eq("id", event.attemptId)
      .eq("connection_id", connectionId)
      .maybeSingle();
    if (attempt.error || !attempt.data) return null;
    if (
      attempt.data.provider_payment_reference
      && event.providerPaymentReference
      && attempt.data.provider_payment_reference !== event.providerPaymentReference
    ) {
      throw new PaymentServerError("INVALID_PAYMENT_EVENT", "Provider payment reference does not match the attempt.");
    }
  } else if (event.kind.startsWith("refund.")) {
    if (!event.providerRefundReference) return null;
    const refund = await supabaseServer
      .from("refunds")
      .select("id")
      .eq("connection_id", connectionId)
      .eq("provider_refund_reference", event.providerRefundReference)
      .maybeSingle();
    if (refund.error || !refund.data) return null;
    event = { ...event, refundId: refund.data.id };
  }
  return { ...event, connectionId };
}

function normalizedEventPayload(event: NormalizedPaymentEvent) {
  return Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined));
}

export async function processDuePaymentEvents(providerKey: string) {
  if (providerKey === "fake" && !isFakePaymentRuntimeEnabled()) {
    throw new PaymentServerError("PAYMENT_PROVIDER_UNAVAILABLE", "The fake payment provider is disabled.");
  }
  if (providerKey === "square" && !isSquareSandboxRuntimeEnabled()) {
    throw new PaymentServerError("PAYMENT_PROVIDER_UNAVAILABLE", "The Square Sandbox payment provider is disabled.");
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
