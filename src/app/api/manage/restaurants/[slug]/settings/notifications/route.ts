import { updateNotificationSettingsRequestSchema } from "@/lib/notifications/contracts";
import {
  getRestaurantNotificationSettings,
  updateRestaurantNotificationSettings,
} from "@/lib/notifications/server";
import { managementErrorStatus } from "@/lib/order-management/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0, must-revalidate" };

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    return Response.json(await getRestaurantNotificationSettings(slug), { headers });
  } catch (error) {
    return Response.json({ error: "Notification settings could not be loaded." }, {
      status: managementErrorStatus(error), headers,
    });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const parsed = updateNotificationSettingsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Notification settings are invalid." }, { status: 400, headers });
  const { clientActionId, ...settings } = parsed.data;
  try {
    return Response.json(await updateRestaurantNotificationSettings(slug, settings, clientActionId), { headers });
  } catch (error) {
    const status = managementErrorStatus(error);
    return Response.json({ error: status === 403 ? "You do not have permission to manage notifications." : "Notification settings could not be saved." }, { status, headers });
  }
}
