export function isUpperCrustConceptPage(pathname: string) {
  return ["/r/upper-crust", "/r/upper-crust/menu", "/r/upper-crust/checkout", "/r/upper-crust/about", "/r/upper-crust/catering"].includes(pathname);
}

export function upperCrustLocalAllowed(env: Record<string, string | undefined>, host: string) {
  return env.MENU_MAN_UPPER_CRUST_LOCAL === "true"
    && env.MENU_MAN_ENV === "staging"
    && !env.VERCEL && !env.VERCEL_ENV
    && env.NEXT_PUBLIC_SUPABASE_URL === "https://jjvongzvtnzlvwdfcnjk.supabase.co"
    && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}
