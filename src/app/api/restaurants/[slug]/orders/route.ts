import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  checkoutRequestSchema,
  idempotencyKeySchema,
  type CheckoutErrorCode,
  type CheckoutRequest,
} from "@/lib/checkout/contracts";
import { CheckoutServerError, createAuthoritativeOrder } from "@/lib/checkout/server";
import { preparePaymentForOrder } from "@/lib/payments/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "no-store" };

type CheckoutFailureStage =
  | "request_validation_failed"
  | "create_order_v1_failure"
  | "payment_preparation_failure";

function logCheckout(stage: string, fields: Record<string, unknown> = {}) {
  console.info("[checkout]", { stage, ...fields });
}

function sensitiveCheckoutValues(checkoutRequest: CheckoutRequest) {
  return [
    checkoutRequest.customer.name,
    checkoutRequest.customer.phone,
    checkoutRequest.customer.email,
    checkoutRequest.orderNotes,
    ...checkoutRequest.items.map((item) => item.specialInstructions),
  ].filter((value): value is string => Boolean(value));
}

function sanitizedErrorValue(value: unknown, sensitiveValues: string[]) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;

  return sensitiveValues.reduce(
    (sanitized, sensitiveValue) => sanitized.replaceAll(sensitiveValue, "[redacted]"),
    value,
  ).slice(0, 2_000);
}

function sanitizedErrorFields(
  error: unknown,
  sensitiveValues: string[],
  errorMessageOverride?: string,
) {
  const errorRecord = typeof error === "object" && error !== null
    ? error as Record<string, unknown>
    : {};

  const fields = {
    errorName: sanitizedErrorValue(
      error instanceof Error ? error.name : errorRecord.name,
      sensitiveValues,
    ),
    errorMessage: errorMessageOverride || sanitizedErrorValue(
      error instanceof Error ? error.message : errorRecord.message,
      sensitiveValues,
    ),
    errorCode: sanitizedErrorValue(errorRecord.code, sensitiveValues),
    details: sanitizedErrorValue(errorRecord.details, sensitiveValues),
    hint: sanitizedErrorValue(errorRecord.hint, sensitiveValues),
  };

  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

function logCheckoutFailure(
  stage: CheckoutFailureStage,
  error: unknown,
  sensitiveValues: string[],
  order?: { orderId: string; orderNumber: string },
) {
  const errorMessageOverride = stage === "request_validation_failed"
    ? "Checkout request validation failed."
    : undefined;

  console.error("[checkout]", {
    stage,
    ...sanitizedErrorFields(error, sensitiveValues, errorMessageOverride),
    ...(order || {}),
  });
}

function statusForError(code: CheckoutErrorCode) {
  if (code === "RESTAURANT_NOT_FOUND") return 404;
  if (code === "IDEMPOTENCY_CONFLICT") return 409;
  if (["ITEM_NOT_ORDERABLE", "ITEM_NOT_ON_MENU", "INVALID_MODIFIERS", "PICKUP_UNAVAILABLE", "MENU_UNAVAILABLE"].includes(code)) return 409;
  if (["ORDERING_DISABLED", "TAX_NOT_CONFIGURED"].includes(code)) return 503;
  if (code === "CHECKOUT_FAILED") return 500;
  return 400;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  logCheckout("request_received");

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    logCheckout("request_validation_failed", { reason: "unsupported_content_type" });
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Checkout requires an application/json request." } },
      { status: 415, headers: responseHeaders },
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 65_536) {
    logCheckout("request_validation_failed", { reason: "request_too_large" });
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Checkout request is too large." } },
      { status: 413, headers: responseHeaders },
    );
  }

  let failureStage: CheckoutFailureStage = "request_validation_failed";
  let sensitiveValues: string[] = [];
  let createdOrder: { orderId: string; orderNumber: string } | undefined;

  try {
    const idempotencyKey = idempotencyKeySchema.parse(request.headers.get("idempotency-key"));
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 65_536) {
      logCheckout("request_validation_failed", { reason: "request_too_large" });
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Checkout request is too large." } },
        { status: 413, headers: responseHeaders },
      );
    }
    const checkoutRequest = checkoutRequestSchema.parse(JSON.parse(rawBody));
    sensitiveValues = sensitiveCheckoutValues(checkoutRequest);
    const { slug } = await params;

    logCheckout("request_validation_passed");
    failureStage = "create_order_v1_failure";
    logCheckout("before_create_order_v1");
    const response = await createAuthoritativeOrder(slug, idempotencyKey, checkoutRequest);
    createdOrder = { orderId: response.orderId, orderNumber: response.orderNumber };
    logCheckout("create_order_v1_success", createdOrder);

    failureStage = "payment_preparation_failure";
    logCheckout("before_payment_preparation", createdOrder);
    const paymentSession = await preparePaymentForOrder(response.orderId);
    logCheckout("payment_preparation_success", {
      ...createdOrder,
      paymentSessionCreated: paymentSession !== null,
    });

    logCheckout("before_return_success", createdOrder);
    return NextResponse.json({ ...response, paymentSession }, {
      status: response.replayed ? 200 : 201,
      headers: responseHeaders,
    });
  } catch (error) {
    logCheckoutFailure(failureStage, error, sensitiveValues, createdOrder);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Checkout request is not valid JSON." } },
        { status: 400, headers: responseHeaders },
      );
    }

    if (error instanceof ZodError) {
      return NextResponse.json({
        error: {
          code: "INVALID_REQUEST",
          message: "Checkout request is invalid.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      }, { status: 400, headers: responseHeaders });
    }

    if (error instanceof CheckoutServerError) {
      return NextResponse.json({
        error: { code: error.code, message: error.message },
      }, { status: statusForError(error.code), headers: responseHeaders });
    }

    return NextResponse.json({
      error: { code: "CHECKOUT_FAILED", message: "Checkout could not be completed." },
    }, { status: 500, headers: responseHeaders });
  }
}
