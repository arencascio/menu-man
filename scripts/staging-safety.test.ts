import assert from "node:assert/strict";
import test from "node:test";
import { assertStagingSupabaseTarget } from "./staging-safety";

const projectRef = "abcdefghijklmnopqrst";
const validEnvironment = {
  MENU_MAN_ENV: "staging",
  MENU_MAN_STAGING_PROJECT_REF: projectRef,
  NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: "test-only-secret",
};

test("accepts an explicitly marked matching hosted staging project", () => {
  assert.deepEqual(assertStagingSupabaseTarget(validEnvironment), {
    projectRef,
    url: `https://${projectRef}.supabase.co`,
  });
});

test("rejects a staging import without the explicit environment marker", () => {
  assert.throws(
    () => assertStagingSupabaseTarget({ ...validEnvironment, MENU_MAN_ENV: "production" }),
    /MENU_MAN_ENV=staging/,
  );
});

test("rejects a configured target that differs from the intended staging ref", () => {
  assert.throws(
    () => assertStagingSupabaseTarget({
      ...validEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "https://differentprojectref.supabase.co",
    }),
    /Refusing staging import/,
  );
});

test("rejects missing project identity or service credentials", () => {
  assert.throws(
    () => assertStagingSupabaseTarget({
      ...validEnvironment,
      MENU_MAN_STAGING_PROJECT_REF: "",
    }),
    /MENU_MAN_STAGING_PROJECT_REF/,
  );
  assert.throws(
    () => assertStagingSupabaseTarget({
      ...validEnvironment,
      SUPABASE_SERVICE_ROLE_KEY: "",
    }),
    /SUPABASE_SERVICE_ROLE_KEY/,
  );
});
