const STAGING_SUPABASE_URL = "https://jjvongzvtnzlvwdfcnjk.supabase.co";
const PREVIEW_BRANCH = "feature/upper-crust-protected-preview-v1";

export function isUpperCrustConceptPage(pathname: string) {
  return ["/r/upper-crust", "/r/upper-crust/menu", "/r/upper-crust/checkout", "/r/upper-crust/about", "/r/upper-crust/catering"].includes(pathname);
}

export function upperCrustLocalAllowed(env: Record<string, string | undefined>, host: string) {
  return env.MENU_MAN_UPPER_CRUST_LOCAL === "true"
    && env.MENU_MAN_ENV === "staging"
    && !env.VERCEL && !env.VERCEL_ENV
    && env.NEXT_PUBLIC_SUPABASE_URL === STAGING_SUPABASE_URL
    && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

// This flag only enables a presentation with unlicensed media omitted. It does
// not grant access. Hosted access also requires Vercel's protected Preview,
// this exact feature branch, staging Supabase, and its exact deployment host.
export function upperCrustPreviewPresentation(env: Record<string, string | undefined>) {
  return env.MENU_MAN_UPPER_CRUST_PREVIEW_ENABLED === "true";
}

export function upperCrustPreviewAllowed(env: Record<string, string | undefined>, host: string) {
  const deploymentHost = env.VERCEL_URL?.toLowerCase();
  return upperCrustPreviewPresentation(env)
    && env.VERCEL === "1"
    && env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_COMMIT_REF === PREVIEW_BRANCH
    && env.NEXT_PUBLIC_SUPABASE_URL === STAGING_SUPABASE_URL
    && Boolean(deploymentHost)
    && deploymentHost!.endsWith(".vercel.app")
    && host.toLowerCase() === deploymentHost;
}

export function upperCrustRequestAllowed(env: Record<string, string | undefined>, host: string) {
  return upperCrustLocalAllowed(env, host) || upperCrustPreviewAllowed(env, host);
}

export function isUpperCrustUnapprovedMediaPath(pathname: string) {
  let normalized = pathname;
  try { normalized = decodeURIComponent(normalized); } catch { /* Malformed paths fail to match the media allowlist. */ }
  normalized = normalized.replaceAll("\\", "/").toLowerCase();
  return normalized.startsWith("/r/upper-crust/reference-media/")
    || normalized.startsWith("/img/sandwich-shop/")
    || normalized.startsWith("/img/upper-crust/")
    || normalized === "/img/icons/google_symbol_0.svg"
    || normalized === "/img/icons/yelp%20icon.svg"
    || normalized === "/img/icons/yelp icon.svg"
    || normalized === "/img/icons/tripadvisor%20wordmark.svg"
    || normalized === "/img/icons/tripadvisor wordmark.svg";
}
