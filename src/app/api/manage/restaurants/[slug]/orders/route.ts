import { NextResponse, type NextRequest } from "next/server";
import { managedOrdersQuerySchema } from "@/lib/order-management/contracts";
import { listManagedOrders, managementErrorStatus } from "@/lib/order-management/server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const params = request.nextUrl.searchParams;
  const parsed = managedOrdersQuerySchema.safeParse({
    view: params.get("view") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    cursorAt: params.get("cursorAt") ?? undefined,
    cursorOrderId: params.get("cursorOrderId") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Order query is invalid." }, { status: 400, headers: noStore });
  }
  try {
    const page = await listManagedOrders(slug, parsed.data);
    return NextResponse.json(page, { headers: noStore });
  } catch (error) {
    const status = managementErrorStatus(error);
    const message = status === 401 ? "Sign in to continue." : status === 403 ? "Restaurant access is unavailable." : "Orders could not be loaded.";
    return NextResponse.json({ error: message }, { status, headers: noStore });
  }
}
