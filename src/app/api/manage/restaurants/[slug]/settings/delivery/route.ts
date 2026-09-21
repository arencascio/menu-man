import { revalidatePath } from "next/cache";
import { updateDeliverySettingsRequestSchema } from "@/lib/restaurant-settings/contracts";
import { getDeliverySettings, updateDeliverySettings } from "@/lib/restaurant-settings/server";
import { managementErrorStatus } from "@/lib/order-management/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0, must-revalidate" };

function failure(error: unknown, operation: string) {
  const status = managementErrorStatus(error);
  return Response.json({
    error: status === 403
      ? "You do not have permission to manage delivery providers."
      : `Delivery providers could not be ${operation}.`,
  }, { status, headers });
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    return Response.json(await getDeliverySettings(slug), { headers });
  } catch (error) {
    return failure(error, "loaded");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const parsed = updateDeliverySettingsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({
      error: parsed.error.issues[0]?.message ?? "Delivery providers are invalid.",
    }, { status: 400, headers });
  }

  const { clientActionId, ...settings } = parsed.data;
  try {
    const result = await updateDeliverySettings(slug, settings, clientActionId);
    revalidatePath(`/r/${slug}`);
    return Response.json(result, { headers });
  } catch (error) {
    return failure(error, "saved");
  }
}
