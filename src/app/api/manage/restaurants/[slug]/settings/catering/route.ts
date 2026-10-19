import { revalidatePath } from "next/cache";
import { getManagedCateringSettings, updateManagedCateringSettings } from "@/lib/catering/server";
import { cateringSettingsSchema } from "@/lib/catering/contracts";
import { boundedJson, privateHeaders, sameOrigin, CateringError } from "@/lib/catering/handler";
import { managementErrorStatus } from "@/lib/order-management/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
const failure = (error: unknown) => Response.json({ error: "Catering settings are unavailable. Verify your access and try again." }, { status: error instanceof CateringError ? error.status : managementErrorStatus(error), headers: privateHeaders });
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { return Response.json(await getManagedCateringSettings((await params).slug), { headers: privateHeaders }); }
  catch (error) { return failure(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!sameOrigin(request)) throw new CateringError(403, "Submit from the management website.");
    const parsed = cateringSettingsSchema.safeExtend({ clientActionId: z.uuid() }).safeParse(await boundedJson(request));
    if (!parsed.success) throw new CateringError(400, parsed.error.issues[0]?.message ?? "Invalid settings.");
    const { slug } = await params;
    const settings = cateringSettingsSchema.parse(Object.fromEntries(Object.entries(parsed.data).filter(([key]) => key !== "clientActionId")));
    const result = await updateManagedCateringSettings(slug, settings);
    revalidatePath(`/r/${slug}`, "layout");
    return Response.json(result, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
