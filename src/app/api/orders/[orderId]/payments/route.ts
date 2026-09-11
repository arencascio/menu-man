import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { paymentSubmissionRequestSchema } from "@/lib/payments/contracts";
import { getGuestPaymentCapability } from "@/lib/payments/capability-cookie";
import { PaymentServerError, submitPayment } from "@/lib/payments/server";

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
    if (contentLength > 4096) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Payment request is too large." } },
        { status: 413, headers },
      );
    }
    const body = paymentSubmissionRequestSchema.parse(await request.json());
    const { orderId } = await params;
    const checkoutToken = await getGuestPaymentCapability(orderId);
    if (!checkoutToken) throw new PaymentServerError("INVALID_PAYMENT_SESSION", "Payment session is unavailable.");
    const payment = await submitPayment(
      orderId,
      checkoutToken,
      body.clientAttemptKey,
      body.paymentMethodToken,
    );
    return NextResponse.json(payment, { status: 202, headers });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Payment request is invalid." } },
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
      { error: { code: "PAYMENT_FAILED", message: "Payment could not be submitted." } },
      { status: 500, headers },
    );
  }
}
