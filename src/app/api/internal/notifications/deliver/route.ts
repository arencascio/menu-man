import { deliverDueNotifications } from "@/lib/notifications/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Not authorized." }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  try {
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
