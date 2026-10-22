export class OpsError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export const opsEnabled = (env: Record<string, string | undefined>) => env.MENU_MAN_OPS_ENABLED === "true";

export async function verifyOpsAccess(options: {
  enabled: boolean;
  user: () => Promise<{ id: string } | null>;
  access: () => Promise<unknown>;
}) {
  if (!options.enabled) throw new OpsError(404, "Not found.");
  const user = await options.user();
  if (!user) throw new OpsError(401, "Sign in to continue.");
  const access = await options.access();
  if (access === "mfa_required") throw new OpsError(428, "Verify your authenticator to continue.");
  if (access !== "authorized") throw new OpsError(403, "Operations access is not authorized.");
  return user.id;
}
