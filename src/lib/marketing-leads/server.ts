import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createLeadStore, type LeadStore } from "./persistence";

export function marketingLeadStore(): LeadStore | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return undefined;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(5_000) }) },
  });
  return createLeadStore(async (name, args) => client.rpc(name, args));
}
