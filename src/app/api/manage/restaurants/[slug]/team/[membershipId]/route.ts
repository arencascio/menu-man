import { NextResponse, type NextRequest } from "next/server";
import { updateRestaurantMemberRequestSchema } from "@/lib/order-management/contracts";
import { managementErrorStatus } from "@/lib/order-management/server";
import { updateRestaurantMember } from "@/lib/order-management/team-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function PATCH(request: NextRequest, context: { params: Promise<{ slug: string; membershipId: string }> }) {
  const { slug, membershipId } = await context.params;
  const parsed = updateRestaurantMemberRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid name, role, and permissions." }, { status: 400, headers });
  try {
    return NextResponse.json(await updateRestaurantMember(slug, membershipId, parsed.data), { headers });
  } catch (error) {
    const status = managementErrorStatus(error);
    return NextResponse.json({ error: error instanceof Error && status < 500 ? error.message : "The team member could not be updated." }, { status, headers });
  }
}
