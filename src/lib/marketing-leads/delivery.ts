import { leadRecipient, leadSubject, leadText } from "./contracts";
import { sendResendEmail } from "../notifications/resend";
import type { LeadClaim, NotificationOutcome } from "./persistence";

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

// Shared by durable capture and owner retry. Version 1 rendering and immutable
// stored details/sender keep the provider's idempotent payload identical.
export async function deliverLeadClaim(claim: LeadClaim, apiKey?: string, fetcher?: typeof fetch): Promise<NotificationOutcome> {
  if (!apiKey || !claim.from) return { state: "failed", providerId: null, errorCode: "configuration_missing", httpStatus: null };
  const lead = claim.lead;
  const text = leadText(lead);
  const result = await sendResendEmail(apiKey, {
    from: claim.from, to: leadRecipient, subject: leadSubject(lead), reply_to: lead.email,
    headers: { "X-Entity-Ref-ID": `MM-${lead.type}-${lead.submissionId.toLowerCase()}` },
    text, html: `<pre style="white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    idempotencyKey: `marketing-lead/${lead.submissionId.toLowerCase()}`,
  }, fetcher ?? ((url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(8_000) })));
  const accepted = result.succeeded && /^[a-zA-Z0-9_-]{1,200}$/.test(result.providerMessageId ?? "");
  const unconfirmed = !accepted && result.httpStatus !== null && result.httpStatus >= 200 && result.httpStatus < 300;
  return {
    state: accepted ? "accepted" : result.retryable || unconfirmed ? "retryable" : "failed",
    providerId: accepted ? result.providerMessageId : null,
    errorCode: accepted ? null : unconfirmed ? "unconfirmed" : result.retryable ? "provider_unavailable" : "provider_rejected",
    httpStatus: result.httpStatus,
  };
}
