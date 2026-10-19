import { expect } from "@playwright/test";
import { test as guardedTest } from "./authenticated-guard-fixtures";
import { AUTHENTICATED_ROLES, QA_ROLES, storageStatePath } from "./staging-auth-config.mjs";

export type AuthenticatedQaRole = typeof AUTHENTICATED_ROLES[number];
export type QaRole = typeof QA_ROLES[number];

export function testForRole(role: QaRole) {
  return guardedTest.extend<{ qaRole: QaRole }>({
    storageState: role === "anonymous" ? undefined : storageStatePath(role),
    qaRole: async ({}, provideRole, testInfo) => {
      guardedTest.skip(testInfo.project.name !== `qa-${role}`, `Run with --project=qa-${role}.`);
      await provideRole(role);
    },
  });
}

export { expect };
