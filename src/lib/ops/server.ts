import "server-only";
import { notFound, redirect } from "next/navigation";
import { createAdminServerClient } from "../supabase/admin-server";
import { createLeadStore } from "../marketing-leads/persistence";
import { detailSchema, inboxSchema, type InboxQuery } from "./contracts";
import { OpsError, opsEnabled, verifyOpsAccess } from "./access";

export async function opsClient() {
  let client: Awaited<ReturnType<typeof createAdminServerClient>>;
  try { client = await createAdminServerClient(); } catch { throw new OpsError(503, "Operations authentication is unavailable."); }
  await verifyOpsAccess({
    enabled: opsEnabled(process.env),
    user: async () => { const { data, error } = await client.auth.getUser(); return error ? null : data.user; },
    access: async () => {
      const { data, error } = await client.rpc("get_ops_access_v1");
      if (error) throw new OpsError(503, "Operations authorization is unavailable.");
      return data;
    },
  });
  return client;
}
export type OpsClient = Awaited<ReturnType<typeof opsClient>>;
export async function opsPageClient() {
  try { return await opsClient(); } catch (error) {
    if (error instanceof OpsError) {
      if (error.status === 401) redirect("/ops/login");
      if (error.status === 428) redirect("/ops/login?result=mfa");
      if (error.status === 403 || error.status === 404) notFound();
    }
    throw new Error("Operations unavailable. No lead information was loaded.");
  }
}
export async function opsRpc(client: OpsClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    if (error.code === "42501") throw new OpsError(403, "Operations access is not authorized.");
    if (error.message === "MM_OPS_CONFLICT") throw new OpsError(409, "This lead changed. Refresh before saving again.");
    if (error.message === "MM_OPS_NOT_FOUND") throw new OpsError(404, "Lead unavailable.");
    throw new OpsError(503, "Operations data is unavailable. Please retry.");
  }
  return data;
}
export async function listOpsLeads(client: OpsClient, query: InboxQuery) {
  const parsed = inboxSchema.safeParse(await opsRpc(client, "list_ops_leads_v1", {
    p_view: query.view, p_status: query.status, p_type: query.type, p_sort: query.sort, p_page: query.page,
  }));
  if (!parsed.success) throw new OpsError(503, "Operations data could not be verified.");
  return parsed.data;
}
export async function getOpsLead(client: OpsClient, id: string) {
  const data = await opsRpc(client, "get_ops_lead_v1", { p_lead_id: id });
  if (data === null) return null;
  const parsed = detailSchema.safeParse(data);
  if (!parsed.success) throw new OpsError(503, "Operations data could not be verified.");
  return parsed.data;
}
export function opsNotificationStore(client: OpsClient) {
  // User-scoped, database-authorized wrappers reuse the original lease/completion
  // rules. Operations never reads or mutates leads with a service-role client.
  return createLeadStore(async (name, args) => {
    const mapped = name === "claim_marketing_lead_notification_v1" ? "claim_ops_lead_notification_v1"
      : name === "complete_marketing_lead_notification_v1" ? "complete_ops_lead_notification_v1" : null;
    if (!mapped) throw new OpsError(403, "Operation not permitted.");
    return client.rpc(mapped, args);
  });
}
