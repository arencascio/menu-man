// Short-lived Vercel development OIDC identity, restricted to the exact QA
// deployment origin. Never send this credential to Yelp, Google, or asset CDNs.
export async function configureUpperCrustQaAuth(context, base) {
  if (!new URL(base).hostname.endsWith(".vercel.app")) return;
  if (!process.env.VERCEL_OIDC_TOKEN) throw new Error("Protected hosted QA requires the linked project's short-lived VERCEL_OIDC_TOKEN.");
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin !== new URL(base).origin) return route.continue();
    return route.continue({ headers: { ...route.request().headers(), "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN } });
  });
}
