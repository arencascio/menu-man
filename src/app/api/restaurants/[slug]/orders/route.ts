import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  checkoutRequestSchema,
  idempotencyKeySchema,
  type CheckoutErrorCode,
} from "@/lib/checkout/contracts";
import { CheckoutServerError, createAuthoritativeOrder } from "@/lib/checkout/server";
import { preparePaymentForOrder } from "@/lib/payments/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "no-store" };

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
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Checkout requires an application/json request." } },
      { status: 415, headers: responseHeaders },
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 65_536) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Checkout request is too large." } },
      { status: 413, headers: responseHeaders },
    );
  }

  try {
    const idempotencyKey = idempotencyKeySchema.parse(request.headers.get("idempotency-key"));
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 65_536) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Checkout request is too large." } },
        { status: 413, headers: responseHeaders },
      );
    }
    const checkoutRequest = checkoutRequestSchema.parse(JSON.parse(rawBody));
    const { slug } = await params;
    const response = await createAuthoritativeOrder(slug, idempotencyKey, checkoutRequest);
    const paymentSession = await preparePaymentForOrder(response.orderId);
    return NextResponse.json({ ...response, paymentSession }, {
      status: response.replayed ? 200 : 201,
      headers: responseHeaders,
    });
  } catch (error) {
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
