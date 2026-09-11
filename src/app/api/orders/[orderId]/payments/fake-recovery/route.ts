import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { fakePaymentRecoveryRequestSchema } from "@/lib/payments/contracts";
import { PaymentServerError, resolveFakeUnknownPayment } from "@/lib/payments/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };

function statusForError(error: PaymentServerError) {
  if (error.code === "INVALID_PAYMENT_SESSION") return 401;
  if (error.code === "PAYMENT_NOT_FOUND") return 404;
  if (error.code === "PAYMENT_PROVIDER_UNAVAILABLE") return 503;
  if (["PAYMENT_NOT_ALLOWED", "PAYMENT_EXPIRED", "PAYMENT_IN_PROGRESS"].includes(error.code)) return 409;
  return 500;
}

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 2048) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Recovery request is too large." } },
        { status: 413, headers },
      );
    }
    const body = fakePaymentRecoveryRequestSchema.parse(await request.json());
    const { orderId } = await params;
    const payment = await resolveFakeUnknownPayment(orderId, body.checkoutToken, body.resolution);
    return NextResponse.json(payment, { status: 202, headers });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Recovery request is invalid." } },
        { status: 400, headers },
      );
    }
    if (error instanceof PaymentServerError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: statusForError(error), headers },
      );
    }
    return NextResponse.json(
      { error: { code: "PAYMENT_FAILED", message: "Payment could not be reconciled." } },
      { status: 500, headers },
    );
  }
}
