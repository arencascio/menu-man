import { isAllowedQaRequest } from "./staging-auth-config.mjs";

export async function installStagingAuthGuard(context) {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const allowed = isAllowedQaRequest(request.url(), request.method(), {
      navigation: request.isNavigationRequest(),
    });
    if (allowed) await route.continue();
    else await route.abort("blockedbyclient");
  });
}
