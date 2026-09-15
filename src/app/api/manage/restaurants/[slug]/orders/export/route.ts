import { type NextRequest } from "next/server";
import { managedOrderExportQuerySchema } from "@/lib/order-management/contracts";
import { csvLine, orderHistoryCsvHeaders, orderHistoryCsvRow } from "@/lib/order-management/csv";
import { createManagedOrderExportPager, managementErrorStatus } from "@/lib/order-management/server";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const parsed = managedOrderExportQuerySchema.safeParse({
    from: request.nextUrl.searchParams.get("from") ?? undefined,
    to: request.nextUrl.searchParams.get("to") ?? undefined,
    dateBasis: request.nextUrl.searchParams.get("dateBasis") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "Choose a valid export date range." }, { status: 400, headers: noStoreHeaders });
  }

  try {
    const pager = await createManagedOrderExportPager();
    const pageSize = 500;
    const firstPage = await pager(slug, { ...parsed.data, limit: pageSize });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`\uFEFF${csvLine(orderHistoryCsvHeaders)}`));
          let page = firstPage;
          while (true) {
            for (const row of page.rows) controller.enqueue(encoder.encode(orderHistoryCsvRow(row)));
            if (!page.nextCursor) break;
            page = await pager(slug, {
              ...parsed.data,
              limit: pageSize,
              cursorAt: page.nextCursor.at,
              cursorOrderId: page.nextCursor.orderId,
            });
          }
          controller.close();
        } catch (error) {
          console.error("[order-management-export]", {
            stage: "stream_failed",
            name: error instanceof Error ? error.name : null,
            message: error instanceof Error ? error.message : "Unknown export error",
          });
          controller.error(error);
        }
      },
    });
    const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "restaurant";
    const filename = `${safeSlug}-orders-${parsed.data.from}-to-${parsed.data.to}.csv`;
    return new Response(stream, {
      headers: {
        ...noStoreHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = managementErrorStatus(error);
    const message = status === 401 ? "Sign in to continue."
      : status === 403 ? "You do not have permission to export this restaurant's orders."
      : "The order export could not be generated.";
    return Response.json({ error: message }, { status, headers: noStoreHeaders });
  }
}
