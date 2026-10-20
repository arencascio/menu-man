import "server-only";
import { createHmac } from "node:crypto";
import { supabaseServer } from "@/lib/supabase/server";
import { demoConnectionPolicy, demoRuntimeAllowed } from "./policy";
import { SUPER_TACOS_ID } from "./policy";
import { requireSquareDemoSandboxConfig } from "@/lib/payments/providers/square/config";
import { SquarePaymentProviderAdapter } from "@/lib/payments/providers/square/adapter";

export function localDemoSource(request: Request) {
  const host = new URL(request.url).hostname;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // All local demo requests share one source budget. Do not trust a caller's IP
  // headers, and never use this fallback on Vercel or a production Node server.
  if (!secret || process.env.VERCEL_ENV || !["development", "test"].includes(process.env.NODE_ENV || "")
    || !["localhost", "127.0.0.1"].includes(host) || !demoRuntimeAllowed(process.env)) return null;
  return createHmac("sha256", secret).update("local-super-tacos-demo:v1").digest("hex");
}

// Resolve the authoritative connection after capability authentication. Never
// infer payment privileges from a URL, request body, or browser configuration.
export async function isDemoPaymentConnection(connectionId: string) {
  const { data, error } = await supabaseServer.from("restaurant_payment_connections")
    .select("restaurant_id, provider_key, environment, provider_metadata, provider_account_reference")
    .eq("id", connectionId).single();
  if (error || !data) throw new Error("Payment connection could not be verified.");
  const demo = demoConnectionPolicy(data, process.env);
  if (demo) {
    const config = requireSquareDemoSandboxConfig();
    if (data.provider_account_reference !== config.merchantId || data.provider_metadata?.locationId !== config.locationId) {
      throw new Error("Demo Sandbox seller/location alignment could not be verified.");
    }
  }
  return demo;
}

export function demoSquareProvider() {
  if (!demoRuntimeAllowed(process.env)) throw new Error("Demo payments are disabled.");
  return new SquarePaymentProviderAdapter(requireSquareDemoSandboxConfig());
}

export async function verifyDemoCheckoutConfiguration() {
  const { data, error } = await supabaseServer.from("restaurant_payment_connections")
    .select("id").eq("restaurant_id", SUPER_TACOS_ID).eq("is_payment_route", true)
    .eq("connection_status", "active").single();
  if (error || !data || !await isDemoPaymentConnection(data.id)) throw new Error("Demo checkout is unavailable.");
}
