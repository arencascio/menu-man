import { NextResponse, type NextRequest } from "next/server";
import { revokeRestaurantMemberRequestSchema } from "@/lib/order-management/contracts";
import { managementErrorStatus } from "@/lib/order-management/server";
import { revokeRestaurantMember } from "@/lib/order-management/team-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string; membershipId: string }> }) {
  const { slug, membershipId } = await context.params;
  const parsed = revokeRestaurantMemberRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The revocation request is invalid." }, { status: 400, headers });
  try {
    return NextResponse.json(await revokeRestaurantMember(slug, membershipId, parsed.data), { headers });
  } catch (error) {
    const status = managementErrorStatus(error);
    return NextResponse.json({ error: error instanceof Error && status < 500 ? error.message : "The team member could not be revoked." }, { status, headers });
  }
}
