import { NextResponse } from "next/server";
import { getPickupAvailability } from "@/lib/checkout/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  Expires: "0",
  Pragma: "no-cache",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const availability = await getPickupAvailability(slug);
    return NextResponse.json(availability, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json(
      { error: { code: "CHECKOUT_FAILED", message: "Pickup availability could not be loaded." } },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
