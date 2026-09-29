import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { managedCancellationRequestSchema } from "@/lib/order-management/contracts";
import { cancelManagedOrder, managementErrorStatus } from "@/lib/order-management/server";

const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request, context: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await context.params;
  if (!z.uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Order was not found." }, { status: 404, headers: noStore });
  }
  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const parsed = managedCancellationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Cancellation request is invalid." }, { status: 400, headers: noStore });
  }
  try {
    const result = await cancelManagedOrder(slug, orderId, parsed.data.clientActionId);
    revalidatePath(`/manage/${slug}/orders/${orderId}`);
    revalidatePath(`/manage/${slug}/orders`);
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    const status = managementErrorStatus(error);
    const message = status === 401 ? "Sign in to cancel this order."
      : status === 403 ? "You do not have permission to cancel this order."
        : status === 404 ? "Order was not found."
          : status === 409 ? (error instanceof Error ? error.message : "This order changed. Refresh and try again.")
            : "Cancellation could not be confirmed. Refresh the order or retry.";
    return NextResponse.json({ error: message }, { status, headers: noStore });
  }
}
