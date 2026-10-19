import { createInquiryHandler } from "@/lib/catering/handler";
import { submitCateringInquiry } from "@/lib/catering/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const handle = createInquiryHandler({ submit: submitCateringInquiry,
  sourceSecret: process.env.SUPABASE_SERVICE_ROLE_KEY, vercelEnvironment: process.env.VERCEL_ENV });
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(request, (await params).slug);
}
