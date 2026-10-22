import { z } from "zod";
import { leadSchema, type MarketingLead } from "./contracts";

export const sourcePages = ["/", "/services", "/work", "/build-my-website"] as const;
const campaignCode = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i);
export const leadContextSchema = z.object({
  sourcePage: z.enum(sourcePages).optional(),
  attribution: z.object({
    utm_source: campaignCode.optional(), utm_medium: campaignCode.optional(),
    utm_campaign: campaignCode.optional(), utm_content: campaignCode.optional(),
    referrer: z.enum(["direct", "internal", "search", "social", "other"]).optional(),
  }).strict().default({}),
}).strict();
export type LeadContext = z.infer<typeof leadContextSchema>;
export type NotificationOutcome = {
  state: "accepted" | "retryable" | "failed";
  providerId: string | null;
  errorCode: "configuration_missing" | "provider_rejected" | "provider_unavailable" | "unconfirmed" | null;
  httpStatus: number | null;
};
export type LeadClaim = { notificationId: string; token: string; lead: MarketingLead; from: string | null };
export interface LeadStore {
  persist(lead: MarketingLead, context: LeadContext, from?: string): Promise<string>;
  claim(leadId: string): Promise<LeadClaim | null>;
  complete(claim: LeadClaim, outcome: NotificationOutcome): Promise<void>;
}
export class LeadConflict extends Error { constructor() { super("Lead submission conflict"); } }

// RPC adapter is injectable for unit/local PostgreSQL tests. Only server.ts supplies credentials.
export function createLeadStore(rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>): LeadStore {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await rpc(name, args);
    if (error) {
      if (error.message === "MM_LEAD_CONFLICT") throw new LeadConflict();
      // Never propagate SQL, payload, contact details, or provider/credential errors.
      throw new Error("Lead storage unavailable");
    }
    return data;
  }
  return {
    async persist(lead, context, from) {
      const { submissionId, type, companyFax: _trap, ...details } = lead;
      void _trap;
      const data = await call("record_marketing_lead_v1", {
        p_submission_id: submissionId.toLowerCase(), p_type: type, p_details: details,
        p_context: context, p_from: from ?? null,
      });
      return z.uuid().parse(data);
    },
    async claim(leadId) {
      const data = await call("claim_marketing_lead_notification_v1", { p_lead_id: leadId });
      if (data === null) return null;
      const claim = z.object({ notificationId: z.uuid(), token: z.uuid(), from: z.string().nullable(), lead: leadSchema }).parse(data);
      return claim;
    },
    async complete(claim, outcome) {
      const data = await call("complete_marketing_lead_notification_v1", {
        p_notification_id: claim.notificationId, p_token: claim.token,
        p_state: outcome.state, p_provider_id: outcome.providerId,
        p_error_code: outcome.errorCode, p_http_status: outcome.httpStatus,
      });
      if (data !== true) throw new Error("Notification completion unconfirmed");
    },
  };
}
