import { createLeadHandler, createLeadLimiter } from "@/lib/marketing-leads/handler";

export const runtime = "nodejs";
const allow = createLeadLimiter();

export async function POST(request: Request) {
  return createLeadHandler({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.MENU_MAN_LEAD_EMAIL_FROM,
    vercel: Boolean(process.env.VERCEL),
    allow,
  })(request);
}
