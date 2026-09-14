import { NextResponse } from "next/server";
import { z } from "zod";
import { getManagedOrderDetail, managementErrorStatus } from "@/lib/order-management/server";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(_request: Request, context: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await context.params;
  if (!z.uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Order was not found." }, { status: 404, headers: noStore });
  }
  try {
    return NextResponse.json(await getManagedOrderDetail(slug, orderId), { headers: noStore });
  } catch (error) {
    const status = managementErrorStatus(error);
    return NextResponse.json({ error: status === 404 ? "Order was not found." : "Order could not be loaded." }, { status, headers: noStore });
  }
}
