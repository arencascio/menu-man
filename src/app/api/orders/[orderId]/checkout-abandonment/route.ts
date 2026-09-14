import { NextResponse } from "next/server";
import {
  clearGuestPaymentCapability,
  getGuestPaymentCapability,
} from "@/lib/payments/capability-cookie";
import { abandonCheckout, PaymentServerError } from "@/lib/payments/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };

function statusForError(error: PaymentServerError) {
  if (error.code === "INVALID_PAYMENT_SESSION") return 401;
  if (error.code === "PAYMENT_NOT_FOUND") return 404;
  if (["PAYMENT_NOT_ALLOWED", "PAYMENT_IN_PROGRESS"].includes(error.code)) return 409;
  return 500;
}

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    const checkoutToken = await getGuestPaymentCapability(orderId);
    if (!checkoutToken) {
      throw new PaymentServerError("INVALID_PAYMENT_SESSION", "Payment session is unavailable.");
    }
    const abandoned = await abandonCheckout(orderId, checkoutToken);
    const response = NextResponse.json(abandoned, { headers });
    clearGuestPaymentCapability(response, orderId);
    return response;
  } catch (error) {
    if (error instanceof PaymentServerError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: statusForError(error), headers },
      );
    }
    return NextResponse.json(
      { error: { code: "PAYMENT_FAILED", message: "Checkout could not be abandoned." } },
      { status: 500, headers },
    );
  }
}
