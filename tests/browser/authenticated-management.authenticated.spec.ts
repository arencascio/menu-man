import { testForRole, expect } from "./authenticated-qa-fixtures";
import { getQaBaseUrl, PRIMARY_TENANT_SLUG, SECOND_TENANT_SLUG } from "./staging-auth-config.mjs";

const roleCases = [
  { role: "owner", slug: PRIMARY_TENANT_SLUG, otherSlug: SECOND_TENANT_SLUG, canManageCatering: true },
  { role: "catering-manager", slug: PRIMARY_TENANT_SLUG, otherSlug: SECOND_TENANT_SLUG, canManageCatering: true },
  { role: "restricted-manager", slug: PRIMARY_TENANT_SLUG, otherSlug: SECOND_TENANT_SLUG, canManageCatering: false },
  { role: "second-tenant-owner", slug: SECOND_TENANT_SLUG, otherSlug: PRIMARY_TENANT_SLUG, canManageCatering: true },
  { role: "anonymous", slug: PRIMARY_TENANT_SLUG, otherSlug: SECOND_TENANT_SLUG, canManageCatering: false },
] as const;

for (const roleCase of roleCases) {
  const test = testForRole(roleCase.role);
  test(`${roleCase.role} session stays within its staging management scope`, async ({ page, qaRole }) => {
    expect(qaRole).toBe(roleCase.role);
    const target = `${getQaBaseUrl()}/manage/${roleCase.slug}/catering`;
    await page.goto(target);

    if (roleCase.role === "anonymous") {
      await expect(page).toHaveURL(/\/manage\/login(?:\?|$)/);
      await expect(page.getByRole("heading", { name: "Catering inquiries" })).toHaveCount(0);
      return;
    }

    if (roleCase.canManageCatering) {
      await expect(page).toHaveURL(target);
      await expect(page.getByRole("heading", { name: "Catering inquiries" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Catering settings" })).toBeVisible();

      const otherTenantTarget = `${getQaBaseUrl()}/manage/${roleCase.otherSlug}/catering`;
      await page.goto(otherTenantTarget);
      await expect(page).not.toHaveURL(otherTenantTarget);
      await expect(page.getByRole("heading", { name: "Catering inquiries" })).toHaveCount(0);
      return;
    }

    await expect(page).not.toHaveURL(target);
    await expect(page.getByRole("heading", { name: "Catering inquiries" })).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/manage/${roleCase.slug}/orders$`));
  });
}
