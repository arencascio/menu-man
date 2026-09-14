import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createAdminServerClient } from "@/lib/supabase/admin-server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = requestedNext?.startsWith("/manage") ? requestedNext : "/manage";
  if (code || (tokenHash && type)) {
    const client = await createAdminServerClient();
    const validOtpTypes = new Set<EmailOtpType>([
      "email", "signup", "invite", "magiclink", "recovery", "email_change",
    ]);
    const { error } = code
      ? await client.auth.exchangeCodeForSession(code)
      : validOtpTypes.has(type as EmailOtpType)
        ? await client.auth.verifyOtp({ token_hash: tokenHash!, type: type as EmailOtpType })
        : { error: new Error("Unsupported email link type") };
    if (!error) {
      const activation = await client.rpc("activate_my_restaurant_memberships_v1");
      if (activation.error) {
        console.error("[team-auth]", {
          stage: "membership_activation_failed",
          code: activation.error.code,
          message: activation.error.message,
        });
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(new URL("/manage/login?error=invalid_link", request.url));
}
