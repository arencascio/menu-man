import { revalidatePath } from "next/cache";
import { updateRestaurantSettingsRequestSchema } from "@/lib/restaurant-settings/contracts";
import { getRestaurantSettings, updateRestaurantSettings } from "@/lib/restaurant-settings/server";
import { managementErrorStatus } from "@/lib/order-management/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0, must-revalidate" };
const failure = (error: unknown, operation: string) => Response.json({ error: managementErrorStatus(error) === 403 ? "You do not have permission to manage restaurant settings." : `Restaurant settings could not be ${operation}.` }, { status: managementErrorStatus(error), headers });

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try { return Response.json(await getRestaurantSettings(slug), { headers }); }
  catch (error) { return failure(error, "loaded"); }
}
export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const parsed = updateRestaurantSettingsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Restaurant settings are invalid." }, { status: 400, headers });
  const { clientActionId, ...settings } = parsed.data;
  try {
    const result = await updateRestaurantSettings(slug, settings, clientActionId);
    revalidatePath(`/r/${slug}`);
    return Response.json(result, { headers });
  } catch (error) { return failure(error, "saved"); }
}
