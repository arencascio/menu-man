import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHENTICATED_ROLES,
  PRIMARY_TENANT_SLUG,
  QA_ROLES,
  SECOND_TENANT_SLUG,
  STAGING_BASE_URL,
  STAGING_SUPABASE_ORIGIN,
  getQaBaseUrl,
  isAllowedQaRequest,
  readQaCredentials,
  roleLandingPath,
  roleSlug,
  storageStatePath,
} from "../tests/browser/staging-auth-config.mjs";

test("QA role configuration maps only the two isolated fixture tenants", () => {
  assert.deepEqual(AUTHENTICATED_ROLES, ["owner", "catering-manager", "restricted-manager", "second-tenant-owner"]);
  assert.equal(QA_ROLES.includes("anonymous"), true);
  assert.equal(roleSlug("owner"), PRIMARY_TENANT_SLUG);
  assert.equal(roleSlug("second-tenant-owner"), SECOND_TENANT_SLUG);
  assert.equal(roleLandingPath("catering-manager"), `/manage/${PRIMARY_TENANT_SLUG}/catering`);
  assert.equal(roleLandingPath("restricted-manager"), `/manage/${PRIMARY_TENANT_SLUG}/orders`);
  assert.equal(storageStatePath("anonymous"), undefined);
  assert.equal(storageStatePath("owner").includes(".playwright"), true);
  assert.throws(() => roleSlug("../../production"), /Unknown authenticated QA role/);
});

test("missing login configuration names variables only and never includes credential values", () => {
  const secretSentinel = "qa-password-must-not-appear";
  assert.throws(() => readQaCredentials({ QA_OWNER_PASSWORD: secretSentinel }), (error) => {
    assert.match(error.message, /QA_OWNER_EMAIL/);
    assert.doesNotMatch(error.message, new RegExp(secretSentinel));
    return true;
  });
});

test("role credentials map from dedicated environment variables without logging", () => {
  const env = {
    QA_OWNER_EMAIL: "owner@example.invalid", QA_OWNER_PASSWORD: "owner-secret",
    QA_CATERING_MANAGER_EMAIL: "manager@example.invalid", QA_CATERING_MANAGER_PASSWORD: "manager-secret",
    QA_RESTRICTED_MANAGER_EMAIL: "restricted@example.invalid", QA_RESTRICTED_MANAGER_PASSWORD: "restricted-secret",
    QA_SECOND_TENANT_OWNER_EMAIL: "second@example.invalid", QA_SECOND_TENANT_OWNER_PASSWORD: "second-secret",
  };
  const credentials = readQaCredentials(env);
  assert.equal(credentials.owner.email, env.QA_OWNER_EMAIL);
  assert.equal(credentials["catering-manager"].password, env.QA_CATERING_MANAGER_PASSWORD);
  assert.equal(credentials["restricted-manager"].email, env.QA_RESTRICTED_MANAGER_EMAIL);
  assert.equal(credentials["second-tenant-owner"].email, env.QA_SECOND_TENANT_OWNER_EMAIL);
});

test("network guard permits only an explicitly selected local app, Staging Auth, and read-only media", () => {
  const previousBaseUrl = process.env.QA_BASE_URL;
  process.env.QA_BASE_URL = "http://127.0.0.1:3000";
  try {
    assert.equal(isAllowedQaRequest(`${STAGING_BASE_URL}/manage`, "GET", { navigation: true }), false);
    assert.equal(isAllowedQaRequest(`${STAGING_SUPABASE_ORIGIN}/auth/v1/token?grant_type=password`, "POST"), true);
    assert.equal(isAllowedQaRequest(`${STAGING_SUPABASE_ORIGIN}/auth/v1/token?grant_type=refresh_token`, "POST"), true);
    assert.equal(isAllowedQaRequest(`${STAGING_SUPABASE_ORIGIN}/auth/v1/user`, "GET"), true);
    assert.equal(isAllowedQaRequest(`${STAGING_SUPABASE_ORIGIN}/storage/v1/object/public/qa/logo.png`, "GET"), true);
    assert.equal(isAllowedQaRequest(`${STAGING_SUPABASE_ORIGIN}/rest/v1/catering_inquiries`, "GET"), false);
    assert.equal(isAllowedQaRequest(`${STAGING_SUPABASE_ORIGIN}/auth/v1/signup`, "POST"), false);
    assert.equal(isAllowedQaRequest("https://us.i.posthog.com/capture/", "POST"), false);
    assert.equal(isAllowedQaRequest("https://getmenuman.com/", "GET", { navigation: true }), false);
    assert.equal(isAllowedQaRequest("https://accounts.google.com/", "GET", { navigation: true }), true);
  } finally {
    if (previousBaseUrl === undefined) delete process.env.QA_BASE_URL;
    else process.env.QA_BASE_URL = previousBaseUrl;
  }
});

test("network guard blocks real order, payment, lead, and delivery mutations", () => {
  const previousBaseUrl = process.env.QA_BASE_URL;
  process.env.QA_BASE_URL = "http://127.0.0.1:3000";
  try {
    for (const path of [
    "/api/orders/123/payments",
    "/api/restaurants/qa/orders",
    "/api/manage/restaurants/qa/orders/123/refunds",
    "/api/marketing/leads",
    "/api/webhooks/payments/fake",
    "/api/internal/notifications/deliver",
    ]) assert.equal(isAllowedQaRequest(`http://127.0.0.1:3000${path}`, "POST"), false, path);
    assert.equal(isAllowedQaRequest("http://127.0.0.1:3000/api/manage/restaurants/qa/catering", "GET"), true);
    assert.equal(isAllowedQaRequest("http://127.0.0.1:3000/api/manage/restaurants/qa/catering", "POST"), false);
  } finally {
    if (previousBaseUrl === undefined) delete process.env.QA_BASE_URL;
    else process.env.QA_BASE_URL = previousBaseUrl;
  }
});

test("local QA target is limited to localhost while Supabase remains pinned to Staging", () => {
  assert.equal(getQaBaseUrl({ QA_BASE_URL: "http://127.0.0.1:3000" }), "http://127.0.0.1:3000");
  assert.equal(getQaBaseUrl({ QA_BASE_URL: "http://localhost:3000/" }), "http://localhost:3000");
  for (const QA_BASE_URL of [
    "https://menu-man-git-staging-arencascio.vercel.app",
    "https://menu-qiwjztql9-arencascio.vercel.app",
    "https://example.com",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3000/manage",
  ]) assert.throws(() => getQaBaseUrl({ QA_BASE_URL }), /must be http/);
  assert.throws(() => getQaBaseUrl({}), /Set QA_BASE_URL explicitly/);
  const previousBaseUrl = process.env.QA_BASE_URL;
  process.env.QA_BASE_URL = "http://127.0.0.1:3000";
  try {
    assert.equal(isAllowedQaRequest("http://127.0.0.1:3000/manage", "GET"), true);
    assert.equal(isAllowedQaRequest("http://127.0.0.1:3000/api/manage/settings", "POST"), false);
    assert.equal(isAllowedQaRequest(`${STAGING_BASE_URL}/manage`, "GET"), false);
    assert.equal(isAllowedQaRequest(`${STAGING_SUPABASE_ORIGIN}/auth/v1/token?grant_type=password`, "POST"), true);
    assert.equal(isAllowedQaRequest("https://fullaiodvmilkdxyxnln.supabase.co/auth/v1/token?grant_type=password", "POST"), false);
  } finally {
    if (previousBaseUrl === undefined) delete process.env.QA_BASE_URL;
    else process.env.QA_BASE_URL = previousBaseUrl;
  }
});
