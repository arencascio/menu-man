import { isProductionManagementDisabled } from "@/lib/production-management-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (isProductionManagementDisabled()) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Not authorized." }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  try {
    const { deliverDueNotifications } = await import("@/lib/notifications/worker");
    const result = await deliverDueNotifications();
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[notifications]", {
      stage: "delivery_batch_failed",
      name: error instanceof Error ? error.name : null,
      message: error instanceof Error ? error.message : "Unknown delivery error",
    });
    return Response.json({ error: "Notification delivery failed." }, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
