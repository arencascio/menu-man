type SiteEnvironment = Record<string, string | undefined>;

export function isProductionSite(env: SiteEnvironment = process.env) {
  return (env.VERCEL_ENV ? env.VERCEL_ENV === "production" : env.MENU_MAN_ENV === "production")
    && env.MENU_MAN_ENV !== "staging";
}

function origin(value: string, hosted: boolean) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/"
    || (hosted ? url.protocol !== "https:" || /^(localhost|127\.|\[::1\])/.test(url.hostname) : !["http:", "https:"].includes(url.protocol))) {
    throw new Error("Configure a valid site origin without credentials, paths, or query parameters.");
  }
  return url.origin;
}

export function resolveSiteOrigin(env: SiteEnvironment = process.env) {
  // Vercel supplies this value; never derive canonical URLs from request headers.
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") {
    const deploymentHost = env.VERCEL_URL || env.VERCEL_BRANCH_URL;
    if (deploymentHost) return origin(`https://${deploymentHost}`, true);
    if (env.NEXT_PUBLIC_SITE_URL) return origin(env.NEXT_PUBLIC_SITE_URL, true);
    throw new Error("Preview requires VERCEL_URL or NEXT_PUBLIC_SITE_URL for absolute URLs.");
  }
  if (env.NEXT_PUBLIC_SITE_URL) return origin(env.NEXT_PUBLIC_SITE_URL, Boolean(env.VERCEL_ENV) || isProductionSite(env));
  return env.VERCEL_ENV === "production" || isProductionSite(env) ? "https://getmenuman.com" : "http://localhost:3000";
}
