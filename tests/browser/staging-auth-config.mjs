import { join } from "node:path";

export const STAGING_BASE_URL = "https://menu-man-git-staging-arencascio.vercel.app";
export const STAGING_SUPABASE_ORIGIN = "https://jjvongzvtnzlvwdfcnjk.supabase.co";
export const PRIMARY_TENANT_SLUG = "menu-man-qa-catering-primary";
export const SECOND_TENANT_SLUG = "menu-man-qa-catering-secondary";

export const AUTHENTICATED_ROLES = ["owner", "catering-manager", "restricted-manager", "second-tenant-owner"];
export const QA_ROLES = [...AUTHENTICATED_ROLES, "anonymous"];

export function getQaBaseUrl(env = process.env) {
  const configured = env.QA_BASE_URL?.trim();
  if (!configured) {
    throw new Error("Set QA_BASE_URL explicitly to http://127.0.0.1:3000 or http://localhost:3000 before running authenticated QA.");
  }
  let url;
  try { url = new URL(configured); } catch { throw new Error("QA_BASE_URL must be the local staging-backed app origin."); }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)
    || url.port !== "3000" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("QA_BASE_URL must be http://127.0.0.1:3000 or http://localhost:3000.");
  }
  return url.origin;
}

const credentialsByRole = {
  owner: ["QA_OWNER_EMAIL", "QA_OWNER_PASSWORD"],
  "catering-manager": ["QA_CATERING_MANAGER_EMAIL", "QA_CATERING_MANAGER_PASSWORD"],
  "restricted-manager": ["QA_RESTRICTED_MANAGER_EMAIL", "QA_RESTRICTED_MANAGER_PASSWORD"],
  "second-tenant-owner": ["QA_SECOND_TENANT_OWNER_EMAIL", "QA_SECOND_TENANT_OWNER_PASSWORD"],
};

export function roleSlug(role) {
  if (role === "second-tenant-owner") return SECOND_TENANT_SLUG;
  if (AUTHENTICATED_ROLES.includes(role) || role === "anonymous") return PRIMARY_TENANT_SLUG;
  throw new Error("Unknown authenticated QA role.");
}

export function roleLandingPath(role) {
  const slug = roleSlug(role);
  return ["owner", "catering-manager", "second-tenant-owner"].includes(role)
    ? `/manage/${slug}/catering`
    : `/manage/${slug}/orders`;
}

export function storageStatePath(role, repositoryRoot = process.cwd()) {
  if (!AUTHENTICATED_ROLES.includes(role)) return undefined;
  const safeRole = role.replaceAll(/[^a-z0-9-]/g, "");
  return join(repositoryRoot, ".playwright", "auth", `${safeRole}.json`);
}

export function readQaCredentials(env = process.env, { requireAll = true } = {}) {
  const missing = requireAll ? Object.values(credentialsByRole).flat().filter((key) => !env[key]?.trim()) : [];
  if (missing.length) {
    throw new Error(`Authenticated staging QA needs these environment variables: ${missing.join(", ")}. Values were not printed.`);
  }
  return Object.fromEntries(Object.entries(credentialsByRole).map(([role, [emailKey, passwordKey]]) => [role, {
    email: env[emailKey]?.trim() ?? "",
    password: env[passwordKey] ?? "",
  }]));
}

export function isAllowedQaRequest(requestUrl, method, { navigation = false } = {}) {
  let url;
  try { url = new URL(requestUrl); } catch { return false; }
  let appOrigin;
  try { appOrigin = new URL(getQaBaseUrl()).origin; } catch { return false; }
  const methodUpper = method.toUpperCase();

  if (url.origin === appOrigin) return ["GET", "HEAD", "OPTIONS"].includes(methodUpper);

  if (url.origin === STAGING_SUPABASE_ORIGIN) {
    if (url.pathname === "/auth/v1/token" && methodUpper === "POST") {
      return ["password", "refresh_token"].includes(url.searchParams.get("grant_type") ?? "");
    }
    if (url.pathname === "/auth/v1/user" && methodUpper === "GET") return true;
    if (url.pathname === "/auth/v1/logout" && methodUpper === "POST") return true;
    if (methodUpper === "GET" && /^\/storage\/v1\/(?:object|render\/image)\/public\//.test(url.pathname)) return true;
    return false;
  }

  if (navigation && (url.hostname === "accounts.google.com" || url.hostname === "github.com"
    || url.hostname === "vercel.com" || url.hostname.endsWith(".vercel.com"))) return true;
  return false;
}

export function loadQaEnv(filePath = ".env.qa.local") {
  if (typeof process.loadEnvFile !== "function") {
    throw new Error("Authenticated QA requires Node.js 20.12 or newer to load .env.qa.local safely.");
  }
  try { process.loadEnvFile(filePath); }
  catch (error) {
    if (error?.code !== "ENOENT") throw new Error("Could not load .env.qa.local; check its syntax without sharing its contents.");
  }
}
