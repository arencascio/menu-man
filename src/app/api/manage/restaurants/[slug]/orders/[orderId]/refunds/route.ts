import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  managedRefundRequestSchema,
  managedRefundResultSchema,
} from "@/lib/order-management/contracts";
import {
  managementErrorStatus,
  reserveManagedRefund,
} from "@/lib/order-management/server";
import { executeReservedRefund } from "@/lib/payments/server";

const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; orderId: string }> },
) {
  const { slug, orderId } = await context.params;
  if (!z.uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Order was not found." }, { status: 404, headers: noStore });
  }

  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const parsed = managedRefundRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid refund amount and reason." }, { status: 400, headers: noStore });
  }

  try {
    const reservation = await reserveManagedRefund(slug, orderId, parsed.data);
    const result = managedRefundResultSchema.parse(await executeReservedRefund(reservation));
    revalidatePath(`/manage/${slug}/orders/${orderId}`);
    revalidatePath(`/manage/${slug}/orders`);
    return NextResponse.json(result, { status: reservation.replayed ? 200 : 201, headers: noStore });
  } catch (error) {
    const status = managementErrorStatus(error);
    const message = status === 401
      ? "Sign in to issue a refund."
      : status === 403
        ? "You do not have permission to issue this refund."
        : status === 404
          ? "Order was not found."
          : status === 409
            ? "The refundable balance changed. Refresh and try again."
            : status === 400
              ? (error instanceof Error ? error.message : "This refund is not eligible.")
              : "The refund request could not be completed. Its status may require review.";
    return NextResponse.json({ error: message }, { status, headers: noStore });
  }
}
