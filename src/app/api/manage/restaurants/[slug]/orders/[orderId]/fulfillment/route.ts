import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fulfillmentTransitionRequestSchema } from "@/lib/order-management/contracts";
import { managementErrorStatus, transitionManagedOrder } from "@/lib/order-management/server";

const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request, context: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await context.params;
  if (!z.uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Order was not found." }, { status: 404, headers: noStore });
  }
  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const parsed = fulfillmentTransitionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Fulfillment request is invalid." }, { status: 400, headers: noStore });
  }
  try {
    const result = await transitionManagedOrder(slug, orderId, parsed.data);
    revalidatePath(`/manage/${slug}/orders/${orderId}`);
    revalidatePath(`/manage/${slug}/orders`);
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    const status = managementErrorStatus(error);
    const message = status === 409 ? "This order changed. Refresh and try again." : status === 403 ? "You do not have permission to advance this order." : "Fulfillment could not be updated.";
    return NextResponse.json({ error: message }, { status, headers: noStore });
  }
}
