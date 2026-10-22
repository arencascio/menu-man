import "server-only";
import { NextResponse } from "next/server";
import { createAdminServerClient } from "../supabase/admin-server";
import { createLeadLimiter } from "../marketing-leads/handler";
import { OpsError, opsEnabled } from "./access";
import { boundedBody, privateHeaders, sameOrigin } from "./http";

const allow = createLeadLimiter();
function location(request: Request, pathname: string) {
  const response = NextResponse.redirect(new URL(pathname, request.url), 303);
  for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
  return response;
}
export async function opsAuth(request: Request, action: "sign-in" | "verify" | "sign-out") {
  try {
    if (!opsEnabled(process.env)) return new Response("Not found", { status: 404, headers: privateHeaders });
    sameOrigin(request);
    if (action !== "sign-out") {
      const source = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for") : request.headers.get("x-forwarded-for");
      if (!allow(source || "unknown")) return new Response("Too many attempts. Wait 15 minutes.", { status: 429, headers: { ...privateHeaders, "Retry-After": "900" } });
    }
    const client = await createAdminServerClient();
    if (action === "sign-out") {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw new OpsError(503, "Sign out could not be confirmed. Please retry.");
      return location(request, "/ops/login");
    }
    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) throw new OpsError(415, "Use the sign-in form.");
    const form = new URLSearchParams(await boundedBody(request, 4096));
    if (action === "sign-in") {
      const email = form.get("email")?.trim() ?? "";
      const password = form.get("password") ?? "";
      if (!email || email.length > 254 || !password || password.length > 1024) return location(request, "/ops/login?result=denied");
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) return location(request, "/ops/login?result=denied");
    }
    const { data: user, error: userError } = await client.auth.getUser();
    if (userError || !user.user) return location(request, "/ops/login?result=denied");
    let access = await client.rpc("get_ops_access_v1");
    if (action === "verify" && !access.error && access.data === "mfa_required") {
      const code = form.get("code") ?? "";
      if (!/^\d{6}$/.test(code)) return location(request, "/ops/login?result=mfa");
      const factors = await client.auth.mfa.listFactors();
      const factor = factors.data?.totp.find(value => value.status === "verified");
      if (!factor) return location(request, "/ops/login?result=provisioning");
      const verified = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (verified.error) return location(request, "/ops/login?result=mfa");
      access = await client.rpc("get_ops_access_v1");
    }
    if (!access.error && access.data === "authorized") return location(request, "/ops");
    if (!access.error && access.data === "mfa_required") return location(request, "/ops/login?result=mfa");
    await client.auth.signOut({ scope: "local" });
    return location(request, "/ops/login?result=denied");
  } catch (error) {
    if (error instanceof OpsError) return new Response(error.message, { status: error.status, headers: privateHeaders });
    return location(request, "/ops/login?result=unavailable");
  }
}
