// Test-only deterministic in-memory double. Production always uses database RPCs.
import { randomUUID } from "node:crypto";
import { LeadConflict, type LeadStore, type LeadClaim, type LeadContext, type NotificationOutcome } from "./persistence";
import type { MarketingLead } from "./contracts";

export function memoryLeadStore() {
  const leads = new Map<string, { id: string; lead: MarketingLead; context: LeadContext; from: string | null }>();
  const claims = new Map<string, LeadClaim>();
  const outcomes = new Map<string, NotificationOutcome>();
  const events: string[] = [];
  const store: LeadStore = {
    async persist(lead, context, from) {
      events.push("persist");
      const existing = leads.get(lead.submissionId);
      if (existing) {
        if (JSON.stringify(existing.lead) !== JSON.stringify(lead)) throw new LeadConflict();
        return existing.id;
      }
      const id = randomUUID();
      leads.set(lead.submissionId, { id, lead, context, from: from ?? null });
      return id;
    },
    async claim(id) {
      events.push("claim");
      if (claims.has(id)) return null;
      const entry = [...leads.values()].find(x => x.id === id)!;
      const claim = { notificationId: randomUUID(), token: randomUUID(), lead: entry.lead, from: entry.from };
      claims.set(id, claim);
      return claim;
    },
    async complete(claim, outcome) { events.push("complete"); outcomes.set(claim.notificationId, outcome); },
  };
  return { store, leads, claims, outcomes, events };
}
