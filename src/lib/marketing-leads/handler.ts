import { createHash } from "node:crypto";
import { leadSchema } from "./contracts";
import { LeadConflict, leadContextSchema, type LeadStore } from "./persistence";
import { deliverLeadClaim } from "./delivery";

// Per-process abuse mitigation, not a distributed quota. Never store raw IPs or lead data.
export function createLeadLimiter() {
  const buckets = new Map<string, { count: number; expires: number }>();
  return (source: string, now = Date.now()) => {
    for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
    const key = createHash("sha256").update(source).digest("hex");
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 5000) return false;
      bucket = { count: 0, expires: now + 15 * 60_000 };
      buckets.set(key, bucket);
    }
    return ++bucket.count <= 5;
  };
}

export function createLeadHandler(options: {
  apiKey?: string;
  from?: string;
  fetcher?: typeof fetch;
  allow?: ReturnType<typeof createLeadLimiter>;
  vercel?: boolean;
  store?: LeadStore;
}) {
  const allow = options.allow ?? createLeadLimiter();
  return async (request: Request) => {
    const respond = (status: number, body: object) => Response.json(body, {
      status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "900" } : {}) },
    });
    if (request.headers.get("origin") !== new URL(request.url).origin
      || request.headers.get("sec-fetch-site") === "cross-site") {
      return respond(403, { error: "Please submit from the Menu Man website." });
    }
    const source = options.vercel ? request.headers.get("x-vercel-forwarded-for") : request.headers.get("x-forwarded-for");
    if (!allow(source || "unknown")) return respond(429, { error: "Too many attempts. Wait 15 minutes or email us directly." });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return respond(415, { error: "Please submit using the website form." });
    }
    let raw = "";
    try {
      const reader = request.body?.getReader();
      if (!reader) throw new Error("Missing body");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16_384) {
          await reader.cancel();
          return respond(413, { error: "Your request is too long. Shorten your notes or email us." });
        }
        chunks.push(value);
      }
      raw = Buffer.concat(chunks).toString("utf8");
    } catch { return respond(400, { error: "We could not read the request. Please retry." }); }
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return respond(400, { error: "Invalid request. Please retry." }); }
    const { context: rawContext, ...payload } = input && typeof input === "object" && !Array.isArray(input)
      ? input as Record<string, unknown> : { context: undefined };
    const context = leadContextSchema.safeParse(rawContext ?? { attribution: {} });
    const parsed = leadSchema.safeParse(payload);
    if (!parsed.success || !context.success) return respond(400, { error: "Check the required fields, email, website address, and text lengths." });
    const lead = parsed.data;
    // Reject traps rather than displaying a false successful submission.
    if (lead.companyFax) return respond(400, { error: "Unable to accept this request. Please email us directly." });
    let leadId: string;
    try {
      if (!options.store) throw new Error("Storage unavailable");
      const from = options.from && options.from.length <= 320 && !/[\r\n]/.test(options.from) ? options.from : undefined;
      leadId = await options.store.persist(lead, context.data, from);
    } catch (error) {
      if (error instanceof LeadConflict) return respond(409, { error: "These details do not match this submission. Start a new inquiry or email us." });
      return respond(503, { error: "We could not save your inquiry. Your details are still here. Please retry or email us below." });
    }
    // The lead/outbox transaction has committed. Email or completion failures must
    // never turn a durable lead into a failed visitor submission. Await all work;
    // no unguaranteed background tasks and no contact/provider details in logs.
    try {
      const claim = await options.store!.claim(leadId);
      if (claim) {
        const outcome = await deliverLeadClaim(claim, options.apiKey, options.fetcher);
        await options.store!.complete(claim, outcome);
      }
    } catch { /* Durable queued/leased record remains recoverable; never log PII. */ }
    return respond(200, { accepted: true, recorded: true });
  };
}
