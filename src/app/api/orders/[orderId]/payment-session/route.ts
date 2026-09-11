import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { paymentSessionRequestSchema } from "@/lib/payments/contracts";
import { getPaymentSession, PaymentServerError } from "@/lib/payments/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const body = paymentSessionRequestSchema.parse(await request.json());
    const { orderId } = await params;
    return NextResponse.json(await getPaymentSession(orderId, body.checkoutToken), { headers });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Payment session request is invalid." } },
        { status: 400, headers },
      );
    }
    if (error instanceof PaymentServerError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "INVALID_PAYMENT_SESSION" ? 401 : 409, headers },
      );
    }
    return NextResponse.json(
      { error: { code: "PAYMENT_FAILED", message: "Payment session could not be loaded." } },
      { status: 500, headers },
    );
  }
}

