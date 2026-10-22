import { opsClient, opsNotificationStore, opsRpc } from "@/lib/ops/server";
import { mutateOpsLead } from "@/lib/ops/actions";
import { boundedBody, sameOrigin, opsResponse, opsFailure } from "@/lib/ops/http";
import { OpsError } from "@/lib/ops/access";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const client = await opsClient();
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new OpsError(415, "JSON request required.");
    let input: unknown;
    try { input = JSON.parse(await boundedBody(request, 40_000)); } catch (error) {
      if (error instanceof OpsError) throw error;
      throw new OpsError(400, "Invalid request.");
    }
    const { id } = await params;
    const result = await mutateOpsLead(id, input, {
      update: args => opsRpc(client, "update_ops_lead_v1", args), notifications: opsNotificationStore(client), apiKey: process.env.RESEND_API_KEY,
    });
    return opsResponse(200, result);
  } catch (error) { return opsFailure(error); }
}
