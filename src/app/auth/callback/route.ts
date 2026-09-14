import { NextResponse, type NextRequest } from "next/server";
import { createAdminServerClient } from "@/lib/supabase/admin-server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = requestedNext?.startsWith("/manage") ? requestedNext : "/manage";
  if (code) {
    const client = await createAdminServerClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/manage/login?error=invalid_link", request.url));
}
