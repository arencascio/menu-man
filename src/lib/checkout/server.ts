import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import {
  checkoutResponseSchema,
  pickupAvailabilitySchema,
  type CheckoutErrorCode,
  type CheckoutRequest,
} from "./contracts";

const knownErrorCodes = new Set<CheckoutErrorCode>([
  "INVALID_REQUEST",
  "RESTAURANT_NOT_FOUND",
  "ORDERING_DISABLED",
  "TAX_NOT_CONFIGURED",
  "MENU_UNAVAILABLE",
  "ITEM_NOT_ORDERABLE",
  "ITEM_NOT_ON_MENU",
  "INVALID_MODIFIERS",
  "PICKUP_UNAVAILABLE",
  "TOTAL_TOO_LARGE",
  "IDEMPOTENCY_CONFLICT",
  "CHECKOUT_FAILED",
]);

export class CheckoutServerError extends Error {
  constructor(
    public readonly code: CheckoutErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function parseDatabaseError(message: string) {
  const match = message.match(/MM_([A-Z_]+)\|([^\n]*)/);
  const code = match?.[1] as CheckoutErrorCode | undefined;
  if (code && knownErrorCodes.has(code)) {
    return new CheckoutServerError(code, match?.[2] || "Checkout could not be completed.");
  }
  return new CheckoutServerError("CHECKOUT_FAILED", "Checkout could not be completed.");
}

function sensitiveCheckoutValues(request: CheckoutRequest, idempotencyKey: string) {
  const values = [
    request.customer.name,
    request.customer.phone,
    request.customer.email,
    request.orderNotes,
    ...request.items.map((item) => item.specialInstructions),
    idempotencyKey,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(values.flatMap((value) => [
    value,
    JSON.stringify(value).slice(1, -1),
  ]))].sort((left, right) => right.length - left.length);
}

function sanitizedRpcErrorValue(value: unknown, sensitiveValues: string[]) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;

  return sensitiveValues.reduce(
    (sanitized, sensitiveValue) => sanitized.replaceAll(sensitiveValue, "[redacted]"),
    value,
  ).slice(0, 2_000);
}

export async function getPickupAvailability(restaurantSlug: string) {
  const { data, error } = await supabaseServer.rpc("get_pickup_availability_v1", {
    p_restaurant_slug: restaurantSlug,
  });
  if (error) throw parseDatabaseError(error.message);

  const parsed = pickupAvailabilitySchema.safeParse(data);
  if (!parsed.success) {
    console.error("Invalid pickup availability response.", parsed.error);
    throw new CheckoutServerError("CHECKOUT_FAILED", "Pickup availability could not be loaded.");
  }
  return parsed.data;
}

export async function createAuthoritativeOrder(
  restaurantSlug: string,
  idempotencyKey: string,
  request: CheckoutRequest,
) {
  const rpcResponse = await supabaseServer.rpc("create_order_v1", {
    p_restaurant_slug: restaurantSlug,
    p_idempotency_key: idempotencyKey,
    p_request: request,
  });
  const { data, error } = rpcResponse;
  if (error) {
    const sensitiveValues = sensitiveCheckoutValues(request, idempotencyKey);
    const logFields = {
      rpc: "create_order_v1",
      code: sanitizedRpcErrorValue(error.code, sensitiveValues),
      message: sanitizedRpcErrorValue(error.message, sensitiveValues),
      details: sanitizedRpcErrorValue(error.details, sensitiveValues),
      hint: sanitizedRpcErrorValue(error.hint, sensitiveValues),
      status: sanitizedRpcErrorValue(rpcResponse.status, sensitiveValues),
      statusText: sanitizedRpcErrorValue(rpcResponse.statusText, sensitiveValues),
    };

    console.error("[checkout-rpc]", Object.fromEntries(
      Object.entries(logFields).filter(([, value]) => value !== undefined),
    ));

    throw parseDatabaseError(error.message);
  }

  const parsed = checkoutResponseSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Invalid authoritative order response.", parsed.error);
    throw new CheckoutServerError("CHECKOUT_FAILED", "The order was created but its response was invalid.");
  }
  return parsed.data;
}
