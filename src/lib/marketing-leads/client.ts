import { leadRecipient, leadText, leadTitles, type MarketingLead } from "./contracts";
import { normalizeWebsite, websiteError } from "./website";
import type { LeadFailureCategory } from "../analytics/types";

export type LeadOutcome = { status: "accepted" } | { status: "failed"; category: LeadFailureCategory };

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
export function createLeadSubmitter(fetcher: typeof fetch = fetch, newId = () => crypto.randomUUID(), observe?: (outcome: LeadOutcome) => void) {
  let pending = false;
  let previous = "";
  let submissionId = "";
  let acceptedId = "";
  const notify = (outcome: LeadOutcome) => { try { observe?.(outcome); } catch { /* Analytics cannot affect delivery. */ } };
  return async (values: Record<string, string>, type: MarketingLead["type"]) => {
    if (pending) return { busy: true } as const;
    pending = true;
    let receivedResponse = false;
    try {
      const website = normalizeWebsite(values.website ?? "");
      if (website === null) {
        notify({ status: "failed", category: "validation" });
        return { error: websiteError } as const;
      }
      const payload = { ...values, website, type, noWebsite: values.noWebsite === "on" };
      const fingerprint = JSON.stringify(payload);
      if (fingerprint !== previous) { previous = fingerprint; submissionId = newId(); }
      const response = await fetcher("/api/marketing/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, submissionId }), signal: AbortSignal.timeout(15_000),
      });
      receivedResponse = true;
      const body = await response.json();
      if (!response.ok || body?.accepted !== true) {
        const category: LeadFailureCategory = response.status === 429 ? "rate_limit"
          : response.status === 503 ? "configuration" : response.status === 502 ? "provider_failure"
          : [400, 403, 413, 415].includes(response.status) ? "validation" : "unconfirmed";
        notify({ status: "failed", category });
        return { error: typeof body?.error === "string" ? body.error : "Delivery was not confirmed. Please retry or email us." } as const;
      }
      if (acceptedId !== submissionId) {
        acceptedId = submissionId;
        notify({ status: "accepted" });
      }
      return { accepted: true } as const;
    } catch {
      notify({ status: "failed", category: receivedResponse ? "unconfirmed" : "network" });
      return { error: "We could not confirm your inquiry. Your details are still here. Retry, or email us below. If rate limited, wait 15 minutes." } as const;
    } finally { pending = false; }
  };
}

export function leadFallback(type: MarketingLead["type"], values: Record<string, string>) {
  const lead = { restaurantName: "", email: "", name: "", phone: "", city: "", website: "", onlineOrdering: "", orderingProviders: "", help: "", notes: "", ...values, type, noWebsite: values.noWebsite === "on" } as MarketingLead;
  return `mailto:${leadRecipient}?subject=${encodeURIComponent(leadTitles[type])}&body=${encodeURIComponent(leadText(lead))}`;
}
