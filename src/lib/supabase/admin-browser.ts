"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createAdminBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Restaurant admin authentication is not configured.");
  return createBrowserClient(url, publishableKey);
}
