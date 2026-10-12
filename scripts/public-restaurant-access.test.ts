import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { proxy, config } from "../src/proxy";
import { isRestaurantPublicationRestricted } from "../src/lib/public-restaurant-access";

test("publication restriction preserves staging and other restaurant access", () => {
  assert.equal(isRestaurantPublicationRestricted("armandos", "production", "staging"), true);
  assert.equal(isRestaurantPublicationRestricted("armandos", "preview", "production"), true);
  assert.equal(isRestaurantPublicationRestricted("armandos", "preview", "staging"), false);
  assert.equal(isRestaurantPublicationRestricted("armandos", undefined, "development"), false);
  assert.equal(isRestaurantPublicationRestricted("other-restaurant", "production", "production"), false);
});

test("production proxy denies demo pages, child routes and APIs before rendering", async () => {
  const previousVercel = process.env.VERCEL_ENV;
  const previousMenuMan = process.env.MENU_MAN_ENV;
  process.env.VERCEL_ENV = "production";
  process.env.MENU_MAN_ENV = "staging";
  try {
    for (const path of [
      "/r/armandos", "/r/armandos/menu", "/r/armandos/location",
      "/r/armandos/checkout", "/r/armandos/order/demo/payment",
      "/r/armandos/order/demo/confirmation", "/r/%61rmandos/menu",
      "/api/restaurants/armandos/pickup-availability", "/api/restaurants/armandos/orders",
      "/api/restaurants/armandos/hearts",
    ]) {
      assert.equal(doesProxyMatch({ config, nextConfig: {}, url: path }), true, path);
      for (const headers of [{}, { RSC: "1", "Next-Router-Prefetch": "1" }] as Record<string, string>[]) {
        const response = await proxy(new NextRequest(`https://getmenuman.com${path}`, { headers }));
        assert.equal(response.status, 404, path);
        assert.equal(await response.text(), "Not found");
        assert.match(response.headers.get("Cache-Control")!, /no-store/);
      }
    }
    const other = await proxy(new NextRequest("https://getmenuman.com/r/other-restaurant/menu"));
    assert.equal(other.headers.get("x-middleware-next"), "1");
    process.env.VERCEL_ENV = "preview";
    const staging = await proxy(new NextRequest("https://preview.example.test/r/armandos/menu"));
    assert.equal(staging.headers.get("x-middleware-next"), "1");
    for (const path of ["/", "/services", "/work", "/build-my-website", "/_next/static/test.js"]) {
      assert.equal(doesProxyMatch({ config, nextConfig: {}, url: path }), false, path);
    }
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousVercel;
    if (previousMenuMan === undefined) delete process.env.MENU_MAN_ENV; else process.env.MENU_MAN_ENV = previousMenuMan;
  }
});
