import { z } from "zod";
import { deleteCateringInquiry, listCateringInquiries, updateCateringInquiry } from "@/lib/catering/server";
import { deleteLeadSchema, updateLeadSchema } from "@/lib/catering/contracts";
import { boundedJson, privateHeaders, sameOrigin, CateringError } from "@/lib/catering/handler";
import { managementErrorStatus } from "@/lib/order-management/server";

export const dynamic = "force-dynamic";
function failure(error: unknown) {
  return Response.json({ error: "Catering inquiries could not be loaded or updated. Refresh and verify your access." }, { status: error instanceof CateringError ? error.status : managementErrorStatus(error), headers: privateHeaders });
}
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const url = new URL(request.url);
  const before = url.searchParams.get("before"), beforeId = url.searchParams.get("beforeId");
  if ((before || beforeId) && (!z.iso.datetime({ offset: true }).safeParse(before).success || !z.uuid().safeParse(beforeId).success)) return Response.json({ error: "Invalid cursor." }, { status: 400, headers: privateHeaders });
  try { return Response.json(await listCateringInquiries((await params).slug, before ?? undefined, beforeId ?? undefined), { headers: privateHeaders }); }
  catch (error) { return failure(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!sameOrigin(request)) throw new CateringError(403, "Submit from the management website.");
    const parsed = updateLeadSchema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new CateringError(400, "Invalid lead update.");
    const { id, status, expectedStatus } = parsed.data;
    await updateCateringInquiry((await params).slug, id, status, expectedStatus);
    return Response.json({ updated: true }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!sameOrigin(request)) throw new CateringError(403, "Submit from the management website.");
    const parsed = deleteLeadSchema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new CateringError(400, "Confirm which inquiry to delete.");
    await deleteCateringInquiry((await params).slug, parsed.data.id, parsed.data.expectedStatus);
    return Response.json({ deleted: true }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
