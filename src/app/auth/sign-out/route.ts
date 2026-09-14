import { NextResponse, type NextRequest } from "next/server";
import { createAdminServerClient } from "@/lib/supabase/admin-server";

export async function POST(request: NextRequest) {
  const client = await createAdminServerClient();
  await client.auth.signOut();
  return NextResponse.redirect(new URL("/manage/login", request.url), 303);
}
