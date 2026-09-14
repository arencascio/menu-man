import { NextResponse, type NextRequest } from "next/server";
import { inviteRestaurantMemberRequestSchema } from "@/lib/order-management/contracts";
import { managementErrorStatus } from "@/lib/order-management/server";
import { inviteRestaurantMember, listRestaurantAccessEvents, listRestaurantTeam } from "@/lib/order-management/team-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

function failure(error: unknown, fallback: string) {
  const status = managementErrorStatus(error);
  return NextResponse.json({ error: status === 401 ? "Sign in to continue." : status === 403 ? "You do not have permission to manage this team." : error instanceof Error && status < 500 ? error.message : fallback }, { status, headers });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    const [members, events] = await Promise.all([
      listRestaurantTeam(slug),
      listRestaurantAccessEvents(slug),
    ]);
    return NextResponse.json({ members, events }, { headers });
  } catch (error) {
    return failure(error, "The restaurant team could not be loaded.");
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const parsed = inviteRestaurantMemberRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email, name, role, and permissions." }, { status: 400, headers });
  try {
    const result = await inviteRestaurantMember(slug, parsed.data, request.nextUrl.origin);
    return NextResponse.json(result, { status: 201, headers });
  } catch (error) {
    return failure(error, "The team member could not be invited.");
  }
}
