import { createLeadHandler, createLeadLimiter } from "@/lib/marketing-leads/handler";
import { marketingLeadStore } from "@/lib/marketing-leads/server";

export const runtime = "nodejs";
const allow = createLeadLimiter();

export async function POST(request: Request) {
  // Lazy configuration: missing credentials/schema fail closed inside the handler.
  let store;
  try { store = marketingLeadStore(); } catch { /* No raw configuration errors in responses/logs. */ }
  return createLeadHandler({
    store,
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.MENU_MAN_LEAD_EMAIL_FROM,
    vercel: Boolean(process.env.VERCEL),
    allow,
  })(request);
}
