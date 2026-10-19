import { expect, test as base } from "@playwright/test";
import { installStagingAuthGuard } from "./staging-auth-guard.mjs";

export const test = base.extend({
  context: async ({ context }, runFixture) => {
    await installStagingAuthGuard(context);
    await runFixture(context);
  },
});

export { expect };
