import { createHash } from "node:crypto";
import { leadRecipient, leadSchema, leadText, leadTitles } from "./contracts";
import { sendResendEmail } from "../notifications/resend";

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

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

export function createLeadHandler(options: {
  apiKey?: string;
  from?: string;
  fetcher?: typeof fetch;
  allow?: ReturnType<typeof createLeadLimiter>;
  vercel?: boolean;
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
    const parsed = leadSchema.safeParse(input);
    if (!parsed.success) return respond(400, { error: "Check the required fields, email, website address, and text lengths." });
    const lead = parsed.data;
    // Reject traps rather than displaying a false successful submission.
    if (lead.companyFax) return respond(400, { error: "Unable to accept this request. Please email us directly." });
    if (!options.apiKey || !options.from || /[\r\n]/.test(options.from)) {
      return respond(503, { error: "Online inquiries are temporarily unavailable. Please email us using the link below." });
    }
    const text = leadText(lead);
    const result = await sendResendEmail(options.apiKey, {
      from: options.from, to: leadRecipient, subject: `Menu Man: ${leadTitles[lead.type]}`,
      reply_to: lead.email,
      text, html: `<pre style="white-space:pre-wrap">${escapeHtml(text)}</pre>`,
      idempotencyKey: `marketing-lead/${lead.submissionId}`,
    }, options.fetcher ?? ((url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })));
    if (!result.succeeded || !result.providerMessageId?.trim()) return respond(502, { error: "We could not confirm delivery. Retry unchanged details, or email us below." });
    return respond(200, { accepted: true });
  };
}
