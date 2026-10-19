import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { createLeadLimiter } from "../marketing-leads/handler";
import { inquirySchema, type InquiryInput } from "./contracts";

export class CateringError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };
export const sameOrigin = (request: Request) => request.headers.get("origin") === new URL(request.url).origin
  && request.headers.get("sec-fetch-site") !== "cross-site";

export async function boundedJson(request: Request, timeoutMs = 5000) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) throw new CateringError(415, "Submit using the website form.");
  const reader = request.body?.getReader();
  if (!reader) throw new CateringError(400, "The request is empty.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timedOut = false;
  const deadline = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => undefined); }, timeoutMs);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) throw new CateringError(408, "Your request took too long. Please retry.");
      if (done) break;
      length += value.byteLength;
      if (length > 16384) { void reader.cancel().catch(() => undefined); throw new CateringError(413, "Shorten your request and try again."); }
      chunks.push(value);
    }
  } finally {
    clearTimeout(deadline);
    reader.releaseLock();
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new CateringError(400, "Invalid request."); }
}

export function cateringSource(request: Request, slug: string, secret: string, vercelEnvironment?: string) {
  const candidate = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  const source = ["preview", "production"].includes(vercelEnvironment ?? "") && candidate && isIP(candidate) ? candidate : "shared-unknown-source";
  return createHmac("sha256", secret).update(`catering:v1:${slug}:${source}`).digest("hex");
}

export function createInquiryHandler(options: {
  submit: (slug: string, input: InquiryInput, request: Request) => Promise<{ replayed: boolean }>;
  allow?: ReturnType<typeof createLeadLimiter>;
  sourceSecret?: string;
  vercelEnvironment?: string;
}) {
  const allow = options.allow ?? createLeadLimiter();
  const sourceSecret = options.sourceSecret || randomBytes(32).toString("hex");
  return async (request: Request, slug: string) => {
    const respond = (status: number, body: object) => Response.json(body, {
      status, headers: { ...privateHeaders, ...(status === 429 ? { "Retry-After": "900" } : {}) },
    });
    try {
      if (!sameOrigin(request)) return respond(403, { error: "Submit from the restaurant website." });
      const parsed = inquirySchema.safeParse(await boundedJson(request));
      if (!parsed.success) return respond(400, { error: "Check the highlighted fields.", fields: Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])) });
      if (parsed.data.companyFax) return respond(400, { error: "Unable to accept this request." });
      // Neither a chosen submission ID nor a made-up slug can allocate buckets.
      // Only the trusted edge source (or one shared fallback) determines this
      // process-wide attempt bucket. Durable creation quotas remain tenant scoped.
      const sourceKey = cateringSource(request, "all-catering-attempts", sourceSecret, options.vercelEnvironment);
      if (!allow(sourceKey)) return respond(429, { error: "Too many attempts. Please wait 15 minutes." });
      const result = await options.submit(slug, parsed.data, request);
      return respond(200, { accepted: true, replayed: result.replayed });
    } catch (error) {
      const status = error instanceof CateringError ? error.status : 503;
      return respond(status, { error: error instanceof CateringError ? error.message : "We could not confirm your request. Retry with the same details." });
    }
  };
}
