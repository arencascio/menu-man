type DeploymentEnvironment = Record<string, string | undefined>;

export function isProductionManagementDisabled(env: DeploymentEnvironment = process.env) {
  return env.VERCEL_ENV === "production" || env.MENU_MAN_ENV === "production";
}

export function isManagementOnlyPath(pathname: string) {
  return /^\/(?:manage|api\/manage)(?:\/|$)/.test(pathname)
    || /^\/auth\/(?:callback|sign-out)(?:\/|$)/.test(pathname);
}
