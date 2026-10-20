import { NextResponse } from "next/server";
import { acceptPaymentWebhook, processDuePaymentEvents } from "@/lib/payments/server";
import { demoRuntimeAllowed } from "@/lib/demo/policy";
import { InvalidSquareWebhookError } from "@/lib/payments/providers/square/webhook";
import { acknowledgeStoredPaymentWebhook } from "@/lib/payments/webhook-acknowledgement";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

async function readBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 65_536) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  let expired = false;
  const deadline = setTimeout(() => { expired = true; void reader.cancel().catch(() => undefined); }, 5000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (expired) throw new Error("body timeout");
      if (done) break;
      size += value.byteLength;
      if (size > 65_536) { void reader.cancel().catch(() => undefined); throw new RangeError(); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { clearTimeout(deadline); reader.releaseLock(); }
}

export async function POST(request: Request) {
  if (!demoRuntimeAllowed(process.env)) return new NextResponse(null, { status: 404, headers });
  let raw: string;
  try { raw = await readBody(request); }
  catch (error) { return new NextResponse(null, { status: error instanceof RangeError ? 413 : 408, headers }); }
  try {
    const accepted = await acknowledgeStoredPaymentWebhook(
      () => acceptPaymentWebhook("square", raw, request.headers, true),
      () => processDuePaymentEvents("square"),
      () => console.error("Demo Sandbox event drain requires a retry."),
    );
    return NextResponse.json({ accepted }, { headers });
  } catch (error) {
    return NextResponse.json({ error: "Demo webhook could not be accepted." }, {
      status: error instanceof InvalidSquareWebhookError ? 403 : 500, headers,
    });
  }
}
