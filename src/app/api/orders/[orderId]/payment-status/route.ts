import { NextResponse } from "next/server";
import { checkoutCapabilitySchema } from "@/lib/payments/contracts";
import { getPaymentStatus, PaymentServerError } from "@/lib/payments/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const checkoutToken = checkoutCapabilitySchema.parse(
      authorization.startsWith("Bearer ") ? authorization.slice(7) : "",
    );
    const { orderId } = await params;
    return NextResponse.json(await getPaymentStatus(orderId, checkoutToken), { headers });
  } catch (error) {
    if (error instanceof PaymentServerError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "INVALID_PAYMENT_SESSION" ? 401 : 409, headers },
      );
    }
    return NextResponse.json(
      { error: { code: "INVALID_PAYMENT_SESSION", message: "Payment status is unavailable." } },
      { status: 401, headers },
    );
  }
}

