// Existing Vercel authentication, restricted to the exact QA deployment origin.
// Prefer development OIDC; an existing CLI automation credential can be supplied
// if the project's Trusted Sources rules reject development OIDC. This helper
// never creates credentials or changes protection settings.
export async function configureUpperCrustQaAuth(context, base) {
  if (!new URL(base).hostname.endsWith(".vercel.app")) return;
  const credential = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
    : process.env.VERCEL_OIDC_TOKEN
      ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
      : null;
  if (!credential) throw new Error("Protected hosted QA requires existing authentication for the linked Vercel project.");
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin !== new URL(base).origin) return route.continue();
    return route.continue({ headers: { ...route.request().headers(), ...credential } });
  });
}
