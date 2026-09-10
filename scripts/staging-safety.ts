type StagingEnvironment = Record<string, string | undefined>;

export type VerifiedStagingTarget = {
  projectRef: string;
  url: string;
};

export function assertStagingSupabaseTarget(
  environment: StagingEnvironment,
): VerifiedStagingTarget {
  if (environment.MENU_MAN_ENV !== "staging") {
    throw new Error("Staging import requires MENU_MAN_ENV=staging");
  }

  const expectedProjectRef = environment.MENU_MAN_STAGING_PROJECT_REF?.trim().toLowerCase();
  if (!expectedProjectRef || !/^[a-z0-9]+$/.test(expectedProjectRef)) {
    throw new Error("Staging import requires a valid MENU_MAN_STAGING_PROJECT_REF");
  }

  const configuredUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredUrl) {
    throw new Error("Staging import requires NEXT_PUBLIC_SUPABASE_URL");
  }

  let target: URL;
  try {
    target = new URL(configuredUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
  }

  const expectedHostname = `${expectedProjectRef}.supabase.co`;
  if (target.protocol !== "https:" || target.hostname.toLowerCase() !== expectedHostname) {
    throw new Error(
      `Refusing staging import: configured Supabase host must be ${expectedHostname}`,
    );
  }

  if (!environment.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Staging import requires SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    projectRef: expectedProjectRef,
    url: target.origin,
  };
}
