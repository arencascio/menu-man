import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { proxy, config } from "../src/proxy";
import { isRestaurantPublicationRestricted } from "../src/lib/public-restaurant-access";
import { isProductionSite } from "../src/lib/seo/site-origin";

test("publication restriction preserves staging and other restaurant access", () => {
  for (const slug of ["armandos", "super-tacos"]) {
    assert.equal(isRestaurantPublicationRestricted(slug, "production", "staging"), true);
    assert.equal(isRestaurantPublicationRestricted(slug, "preview", "production"), true);
    assert.equal(isRestaurantPublicationRestricted(slug.toUpperCase(), "production", "production"), true);
    assert.equal(isRestaurantPublicationRestricted(slug, "preview", "staging"), false);
    assert.equal(isRestaurantPublicationRestricted(slug, "development", "development"), false);
    assert.equal(isRestaurantPublicationRestricted(slug, "", "staging"), false);
  }
  for (const slug of ["other-restaurant", "test-kitchen", "super-tacos-annex", "armandos-annex"]) {
    assert.equal(isRestaurantPublicationRestricted(slug, "production", "production"), false);
  }
});

test("production proxy denies demo pages, child routes and APIs before rendering", async () => {
  const previousVercel = process.env.VERCEL_ENV;
  const previousMenuMan = process.env.MENU_MAN_ENV;
  process.env.VERCEL_ENV = "production";
  process.env.MENU_MAN_ENV = "staging";
  try {
    const paths = ["armandos", "super-tacos"].flatMap((slug) => [
      `/r/${slug}`, `/r/${slug}/menu`, `/r/${slug}/location`,
      `/r/${slug}/checkout`, `/r/${slug}/order/demo/payment`,
      `/r/${slug}/order/demo/confirmation`, `/r/${slug.toUpperCase()}/menu`,
      `/api/restaurants/${slug}/pickup-availability`, `/api/restaurants/${slug}/orders`,
      `/api/restaurants/${slug}/hearts`,
    ]).concat("/r/%61rmandos/menu", "/api/restaurants/%73uper-tacos/orders");
    for (const path of paths) {
      assert.equal(doesProxyMatch({ config, nextConfig: {}, url: path }), true, path);
      for (const headers of [{}, { RSC: "1", "Next-Router-Prefetch": "1" }] as Record<string, string>[]) {
        const response = await proxy(new NextRequest(`https://getmenuman.com${path}`, { headers }));
        assert.equal(response.status, 404, path);
        assert.equal(await response.text(), "Not found");
        assert.match(response.headers.get("Cache-Control")!, /no-store/);
        assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
      }
    }
    for (const path of ["/r/other-restaurant/menu", "/api/restaurants/other-restaurant/orders"]) {
      const other = await proxy(new NextRequest(`https://getmenuman.com${path}`));
      assert.equal(other.headers.get("x-middleware-next"), "1");
    }
    // MENU_MAN_ENV alone must retain the same production protection.
    process.env.VERCEL_ENV = "preview";
    process.env.MENU_MAN_ENV = "production";
    for (const path of paths) {
      assert.equal((await proxy(new NextRequest(`https://preview.example.test${path}`))).status, 404, path);
    }
    process.env.MENU_MAN_ENV = "staging";
    for (const path of paths) {
      const staging = await proxy(new NextRequest(`https://preview.example.test${path}`));
      assert.equal(staging.headers.get("x-middleware-next"), "1", path);
    }
    for (const path of ["/", "/services", "/work", "/build-my-website", "/_next/static/test.js"]) {
      assert.equal(doesProxyMatch({ config, nextConfig: {}, url: path }), false, path);
    }
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousVercel;
    if (previousMenuMan === undefined) delete process.env.MENU_MAN_ENV; else process.env.MENU_MAN_ENV = previousMenuMan;
  }
});

test("sitemap excludes nonproduction tenants and fails closed on missing publication columns", async () => {
  const previousVercel = process.env.VERCEL_ENV;
  const previousMenuMan = process.env.MENU_MAN_ENV;
  const source = readFileSync("src/app/sitemap.ts", "utf8");
  // Execute the real sitemap with only its database and site URL dependencies stubbed.
  // This avoids server-only initialization and guarantees no database access.
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  try {
    for (const fallback of [false, true]) {
      for (const [vercel, menuMan, restricted] of [
        ["production", "staging", true],
        ["production", "production", true],
        ["preview", "production", true],
        ["preview", "staging", false],
      ] as const) {
        process.env.VERCEL_ENV = vercel;
        process.env.MENU_MAN_ENV = menuMan;
        let queries = 0;
        const supabaseServer = {
          from(table: string) {
            assert.equal(table, "restaurants");
            const queryNumber = ++queries;
            const filters: string[] = [];
            return {
              select(columns: string) { assert.equal(columns, "slug"); return this; },
              eq(column: string, value: boolean) { assert.equal(value, true); filters.push(column); return this; },
              then(resolve: (value: unknown) => unknown) {
                assert.deepEqual(filters, fallback && queryNumber === 2 ? ["is_active"] : ["is_active", "is_indexable"]);
                return Promise.resolve(resolve(fallback && queryNumber === 1
                  ? { data: null, error: { code: "42703" } }
                  : { data: ["armandos", "super-tacos", "other-restaurant"].map((slug) => ({ slug })), error: null }));
              },
            };
          },
        };
        const exports: { default?: () => Promise<Array<{ url: string }>> } = {};
        runInNewContext(compiled, {
          exports,
          require(id: string) {
            if (id === "@/lib/supabase/server") return { supabaseServer };
            if (id === "@/lib/seo/restaurant-metadata") return { siteUrl: "https://getmenuman.com", isProductionSite };
            if (id === "@/lib/public-restaurant-access") return { isRestaurantPublicationRestricted };
            throw new Error(`Unexpected sitemap dependency: ${id}`);
          },
        });
        const urls = new Set((await exports.default!()).map(({ url }) => url));
        for (const slug of ["armandos", "super-tacos"]) {
          assert.equal(urls.has(`https://getmenuman.com/r/${slug}`), isProductionSite() && !fallback && !restricted);
        }
        assert.equal(urls.has("https://getmenuman.com/r/other-restaurant"), isProductionSite() && !fallback);
        assert.ok(urls.has("https://getmenuman.com/work"));
        assert.equal(queries, isProductionSite() ? 1 : 0);
      }
    }
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousVercel;
    if (previousMenuMan === undefined) delete process.env.MENU_MAN_ENV; else process.env.MENU_MAN_ENV = previousMenuMan;
  }
});
