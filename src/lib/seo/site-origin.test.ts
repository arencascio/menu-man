import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { isProductionSite, resolveSiteOrigin } from "./site-origin";

test("site origins distinguish local, Preview deployment, and Production canonical URLs", () => {
  assert.equal(resolveSiteOrigin({}), "http://localhost:3000");
  assert.equal(resolveSiteOrigin({ VERCEL_ENV: "production" }), "https://getmenuman.com");
  assert.equal(resolveSiteOrigin({ VERCEL_ENV: "production", MENU_MAN_ENV: "staging" }), "https://getmenuman.com");
  assert.equal(resolveSiteOrigin({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://www.getmenuman.com/" }), "https://www.getmenuman.com");
  assert.equal(resolveSiteOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "menu-qa-arencascio.vercel.app", NEXT_PUBLIC_SITE_URL: "https://getmenuman.com" }), "https://menu-qa-arencascio.vercel.app");
  assert.equal(resolveSiteOrigin({ VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "menu-staging.vercel.app" }), "https://menu-staging.vercel.app");
  assert.equal(resolveSiteOrigin({ VERCEL_ENV: "preview", NEXT_PUBLIC_SITE_URL: "https://qa.example.com" }), "https://qa.example.com");
});

test("hosted origins fail closed instead of emitting localhost or unsafe URLs", () => {
  for (const value of ["http://localhost:3000", "https://127.0.0.1", "https://example.com/path", "https://user:secret@example.com", "https://example.com/?token=private", "javascript:alert(1)"]) {
    assert.throws(() => resolveSiteOrigin({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: value }));
  }
  assert.throws(() => resolveSiteOrigin({ VERCEL_ENV: "preview" }));
  assert.throws(() => resolveSiteOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "localhost:3000" }));
});

test("nonproduction robots disallow crawling and use the deployment origin", () => {
  const code = transpileModule(readFileSync("src/app/robots.ts", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  for (const production of [false, true]) {
    const exports: { default?: () => { rules: { allow?: string; disallow?: string }; sitemap: string } } = {};
    runInNewContext(code, { exports, require: () => ({ siteUrl: "https://qa.example.com", isProductionSite: () => production }) });
    const result = exports.default!();
    assert.equal(result.sitemap, "https://qa.example.com/sitemap.xml");
    assert.equal(production ? result.rules.allow : result.rules.disallow, "/");
    assert.equal(production ? result.rules.disallow : result.rules.allow, undefined);
  }
  assert.equal(isProductionSite({ VERCEL_ENV: "preview", MENU_MAN_ENV: "production" }), false);
  assert.equal(isProductionSite({ VERCEL_ENV: "production", MENU_MAN_ENV: "staging" }), false);
});

test("restaurant metadata on Preview ignores Production tenant domains and cannot opt into indexing", () => {
  const code = transpileModule(readFileSync("src/lib/seo/restaurant-metadata.ts", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  const exports: { restaurantUrl?: (s: string, domain: string) => string; createRestaurantMetadata?: (options: object) => { robots: { index: boolean; follow: boolean } } } = {};
  runInNewContext(code, { exports, require: () => ({ isProductionSite: () => false, resolveSiteOrigin: () => "https://preview.example.com" }) });
  assert.equal(exports.restaurantUrl!("test-kitchen", "production-restaurant.example.com"), "https://preview.example.com/r/test-kitchen");
  const metadata = exports.createRestaurantMetadata!({ name: "Test", slug: "test-kitchen", tagline: null, description: null, heroImageUrl: null, logoUrl: null, primaryDomain: "production-restaurant.example.com", indexable: true });
  assert.equal(metadata.robots.index, false); assert.equal(metadata.robots.follow, false);
});

test("Preview menu and location explicitly remain noindex even for indexable fixtures", async () => {
  for (const route of ["menu", "location"]) {
    const code = transpileModule(readFileSync(`src/app/r/[slug]/${route}/page.tsx`, "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
    const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { name: "QA", primary_domain: "production.example.com", is_indexable: true } }; } };
    const exports: { generateMetadata?: (context: { params: Promise<{ slug: string }> }) => Promise<{ robots: { index: boolean } }> } = {};
    runInNewContext(code, { exports, require(name: string) {
      if (name === "@/lib/supabase/server") return { supabaseServer: { from: () => query } };
      if (name === "@/lib/seo/restaurant-metadata") return { isProductionSite: () => false, restaurantUrl: () => "https://preview.example.com/r/qa" };
      return {};
    } });
    assert.equal((await exports.generateMetadata!({ params: Promise.resolve({ slug: "qa" }) })).robots.index, false);
  }
});
