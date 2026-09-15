import { listRestaurantMemberships, managementErrorStatus } from "@/lib/order-management/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0, must-revalidate" };

export async function GET() {
  try {
    return Response.json({ memberships: await listRestaurantMemberships() }, { headers });
  } catch (error) {
    return Response.json({ memberships: [], error: "Restaurant access could not be checked." }, {
      status: managementErrorStatus(error), headers,
    });
  }
}
