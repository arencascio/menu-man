import { NextResponse } from "next/server";
import { acceptPaymentWebhook, processDuePaymentEvents } from "@/lib/payments/server";
import { isSquareSandboxRuntimeEnabled } from "@/lib/payments/runtime";
import { InvalidSquareWebhookError } from "@/lib/payments/providers/square/webhook";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isSquareSandboxRuntimeEnabled()) {
    return new NextResponse(null, { status: 404, headers: responseHeaders });
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 65_536) {
    return NextResponse.json({ error: "Webhook is too large." }, { status: 413, headers: responseHeaders });
  }
  try {
    const accepted = await acceptPaymentWebhook("square", rawBody, request.headers);
    await processDuePaymentEvents("square");
    return NextResponse.json({ accepted }, { status: 200, headers: responseHeaders });
  } catch (error) {
    if (!(error instanceof InvalidSquareWebhookError)) {
      return NextResponse.json(
        { error: "Webhook processing is temporarily unavailable." },
        { status: 500, headers: responseHeaders },
      );
    }
    return NextResponse.json(
      { error: "Webhook could not be verified." },
      { status: 403, headers: responseHeaders },
    );
  }
}
