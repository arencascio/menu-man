import { NextResponse } from "next/server";
import { acceptPaymentWebhook, processDuePaymentEvents } from "@/lib/payments/server";
import { isFakePaymentRuntimeEnabled } from "@/lib/payments/runtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isFakePaymentRuntimeEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 65_536) {
    return NextResponse.json({ error: "Webhook is too large." }, { status: 413 });
  }

  try {
    const accepted = await acceptPaymentWebhook("fake", rawBody, request.headers);
    await processDuePaymentEvents("fake");
    return NextResponse.json({ accepted }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Webhook could not be verified." }, { status: 401 });
  }
}

