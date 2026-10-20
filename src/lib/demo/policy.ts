// A fixed, synthetic tenant identity, never a user-supplied demo switch.
export const SUPER_TACOS_ID = "20000000-0000-4000-8000-000000000001";
export const SUPER_TACOS_SLUG = "super-tacos";
export const DEMO_PAYMENT_TOKEN = "demo:square-sandbox";
export const SQUARE_DEMO_SOURCE = "cnon:card-nonce-ok";
export const DEMO_CUSTOMER = { name: "Demo Guest", phone: "202-555-0142", email: "guest@example.invalid" };

export function isDemoRestaurant(id: string) { return id === SUPER_TACOS_ID; }

export function demoRuntimeAllowed(env: Record<string, string | undefined>) {
  let project = "";
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "");
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return false;
    project = url.hostname;
  } catch { return false; }
  return project === "jjvongzvtnzlvwdfcnjk.supabase.co"
    && env.MENU_MAN_ENV === "staging"
    && env.VERCEL_ENV !== "production"
    && env.MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS === "true"
    && env.MENU_MAN_ENABLE_SQUARE_SANDBOX === "true";
}

export function demoConnectionPolicy(connection: {
  restaurant_id: string; provider_key: string; environment: string; provider_metadata: unknown;
}, env: Record<string, string | undefined>) {
  const metadata = connection.provider_metadata as Record<string, unknown> | null;
  const marked = metadata?.publicDemo === true;
  if (!isDemoRestaurant(connection.restaurant_id)) {
    if (marked) throw new Error("Demo payment configuration does not match the demo tenant.");
    return false;
  }
  if (!marked || connection.provider_key !== "square" || connection.environment !== "sandbox" || !demoRuntimeAllowed(env)) {
    throw new Error("Demo payments are unavailable in this environment.");
  }
  return true;
}

export function paymentSourceForPolicy(demo: boolean, token: string) {
  if (demo) {
    if (token !== DEMO_PAYMENT_TOKEN) throw new Error("Only the preselected demo payment is accepted.");
    return SQUARE_DEMO_SOURCE;
  }
  if (token === DEMO_PAYMENT_TOKEN) throw new Error("Demo payment is unavailable for this restaurant.");
  return token;
}
