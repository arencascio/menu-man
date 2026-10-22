import { z } from "zod";
import { deliverLeadClaim } from "../marketing-leads/delivery";
import type { LeadStore } from "../marketing-leads/persistence";
import { mutationSchema } from "./contracts";
import { OpsError } from "./access";

// Dependencies are authorized by the route; database RPCs independently enforce
// owner/session/MFA on every call, including concurrent retry claims.
export async function mutateOpsLead(id: string, input: unknown, options: {
  update: (args: Record<string, unknown>) => Promise<unknown>;
  notifications: Pick<LeadStore, "claim" | "complete">;
  apiKey?: string; fetcher?: typeof fetch;
}) {
  const parsed = mutationSchema.safeParse(input);
  if (!z.uuid().safeParse(id).success || !parsed.success) throw new OpsError(400, "Check status, notes, follow-up date, and revision.");
  const action = parsed.data;
  if (action.action === "save") {
    await options.update({ p_lead_id: id, p_revision: action.revision, p_status: action.status, p_notes: action.notes, p_follow_up_at: action.followUpAt });
    return { saved: true };
  }
  if (!options.apiKey) throw new OpsError(503, "Email sending is unavailable. The lead is safely stored.");
  const claim = await options.notifications.claim(id);
  if (!claim) throw new OpsError(409, "Retry is not eligible or another request holds the lease. Refresh for current state.");
  const outcome = await deliverLeadClaim(claim, options.apiKey, options.fetcher);
  await options.notifications.complete(claim, outcome);
  return { saved: true, notification: outcome.state };
}
