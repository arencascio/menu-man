import { NextResponse, type NextRequest } from "next/server";
import { membershipActionRequestSchema } from "@/lib/order-management/contracts";
import { managementErrorStatus } from "@/lib/order-management/server";
import { resendRestaurantInvitation } from "@/lib/order-management/team-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string; membershipId: string }> }) {
  const { slug, membershipId } = await context.params;
  const parsed = membershipActionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The resend request is invalid." }, { status: 400, headers });
  try {
    return NextResponse.json(await resendRestaurantInvitation(slug, membershipId, parsed.data.clientActionId, request.nextUrl.origin), { headers });
  } catch (error) {
    const status = managementErrorStatus(error);
    return NextResponse.json({ error: error instanceof Error && status < 500 ? error.message : "The invitation could not be resent." }, { status, headers });
  }
}
