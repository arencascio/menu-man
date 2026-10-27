import { isUpperCrustProtectedMediaPath } from "./protected-media";

const STAGING_SUPABASE_URL = "https://jjvongzvtnzlvwdfcnjk.supabase.co";
const PREVIEW_BRANCHES = new Set(["feature/upper-crust-protected-preview-v1", "feature/upper-crust-original-media-v1", "feature/upper-crust-menu-corrections", "feature/upper-crust-photography-reviews-v1", "staging"]);

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

// This flag selects the owner-attested protected Preview presentation. It does
// not grant access. Hosted access still requires Vercel Preview, an allowlisted
// branch, staging Supabase, and the exact deployment host.
export function upperCrustPreviewPresentation(env: Record<string, string | undefined>) {
  return env.MENU_MAN_UPPER_CRUST_PREVIEW_ENABLED === "true";
}

export function upperCrustPreviewAllowed(env: Record<string, string | undefined>, host: string) {
  const deploymentHost = env.VERCEL_URL?.toLowerCase();
  return upperCrustPreviewPresentation(env)
    && env.VERCEL === "1"
    && env.VERCEL_ENV === "preview"
    && PREVIEW_BRANCHES.has(env.VERCEL_GIT_COMMIT_REF ?? "")
    && env.NEXT_PUBLIC_SUPABASE_URL === STAGING_SUPABASE_URL
    && Boolean(deploymentHost)
    && deploymentHost!.endsWith(".vercel.app")
    && host.toLowerCase() === deploymentHost;
}

export function upperCrustRequestAllowed(env: Record<string, string | undefined>, host: string) {
  return upperCrustLocalAllowed(env, host) || upperCrustPreviewAllowed(env, host);
}

export function upperCrustProtectedMediaRequestAllowed(
  env: Record<string, string | undefined>,
  host: string,
  pathname: string,
  method: string,
) {
  return ["GET", "HEAD"].includes(method)
    && isUpperCrustProtectedMediaPath(pathname)
    && upperCrustRequestAllowed(env, host);
}

export function isUpperCrustUnapprovedMediaPath(pathname: string) {
  let normalized = pathname.replaceAll("\\", "/").toLowerCase();
  for (let depth = 0; depth < 3; depth++) {
    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
    } catch { break; }
  }
  normalized = normalized.replaceAll("\\", "/").replace(/\/{2,}/g, "/");
  return normalized.startsWith("/r/upper-crust/reference-media/")
    || normalized.startsWith("/img/sandwich-shop/")
    || normalized.startsWith("/img/upper-crust/")
    || normalized === "/img/icons/google_symbol_0.svg"
    || normalized === "/img/icons/yelp%20icon.svg"
    || normalized === "/img/icons/yelp icon.svg"
    || normalized === "/img/icons/tripadvisor%20wordmark.svg"
    || normalized === "/img/icons/tripadvisor wordmark.svg";
}
