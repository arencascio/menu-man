import { revalidatePath } from "next/cache";
import { managementErrorStatus } from "@/lib/order-management/server";
import { updateFeaturedSettingsRequestSchema } from "@/lib/restaurant-settings/contracts";
import { getFeaturedSettings, updateFeaturedSettings } from "@/lib/restaurant-settings/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const status = managementErrorStatus(error);
  return Response.json({ error: status === 403 ? "You do not have permission to manage Featured items." : "Featured items could not be loaded or saved." }, { status, headers });
}
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { return Response.json(await getFeaturedSettings((await params).slug), { headers }); }
  catch (error) { return failure(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const parsed = updateFeaturedSettingsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid selections." }, { status: 400, headers });
  const { slug } = await params;
  try {
    const result = await updateFeaturedSettings(slug, parsed.data.selectedItemIds, parsed.data.clientActionId);
    revalidatePath(`/r/${slug}/menu`);
    return Response.json(result, { headers });
  } catch (error) { return failure(error); }
}
