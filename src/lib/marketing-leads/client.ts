import { leadRecipient, leadText, leadTitles, type MarketingLead } from "./contracts";

export type LeadFormState = { values: Record<string, string>; pending: boolean; accepted: boolean; error: string };
export const initialLeadState: LeadFormState = { values: {}, pending: false, accepted: false, error: "" };
export type LeadFormAction =
  | { type: "edit"; values: Record<string, string> }
  | { type: "start" }
  | { type: "accepted" }
  | { type: "failed"; error: string };
export function leadFormReducer(state: LeadFormState, action: LeadFormAction): LeadFormState {
  if (action.type === "edit") return { ...state, values: action.values };
  if (action.type === "start") return { ...state, pending: true, accepted: false, error: "" };
  if (action.type === "accepted") return { ...state, pending: false, accepted: true, error: "" };
  return { ...state, pending: false, accepted: false, error: action.error };
}

// The synchronous lock covers double-clicks before React can render disabled buttons.
export function createLeadSubmitter(fetcher: typeof fetch = fetch, newId = () => crypto.randomUUID()) {
  let pending = false;
  let previous = "";
  let submissionId = "";
  return async (values: Record<string, string>, type: MarketingLead["type"]) => {
    if (pending) return { busy: true } as const;
    pending = true;
    try {
      const payload = { ...values, type, noWebsite: values.noWebsite === "on" };
      const fingerprint = JSON.stringify(payload);
      if (fingerprint !== previous) { previous = fingerprint; submissionId = newId(); }
      const response = await fetcher("/api/marketing/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, submissionId }), signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json();
      if (!response.ok || body?.accepted !== true) return {
        error: typeof body?.error === "string" ? body.error : "Delivery was not confirmed. Please retry or email us.",
      } as const;
      return { accepted: true } as const;
    } catch {
      return { error: "We could not confirm your inquiry. Your details are still here. Retry, or email us below. If rate limited, wait 15 minutes." } as const;
    } finally { pending = false; }
  };
}

export function leadFallback(type: MarketingLead["type"], values: Record<string, string>) {
  const lead = { restaurantName: "", email: "", name: "", phone: "", city: "", website: "", onlineOrdering: "", orderingProviders: "", help: "", notes: "", ...values, type, noWebsite: values.noWebsite === "on" } as MarketingLead;
  return `mailto:${leadRecipient}?subject=${encodeURIComponent(leadTitles[type])}&body=${encodeURIComponent(leadText(lead))}`;
}
