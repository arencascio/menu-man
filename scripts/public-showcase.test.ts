// Focused regression entry point; explicit imports support literal [slug] paths
// on Windows without relying on test-runner shell glob expansion.
import "../src/lib/demo/demo.test";
import "../src/lib/demo/server.integration.test";
import "./public-restaurant-access.test";
import "./route-checkout-contract.test";
import "../src/lib/cart/cart.test";
import "../src/lib/checkout/contracts.test";
import "../src/lib/checkout/replay.test";
import "../src/lib/payments/contracts.test";
import "../src/lib/payments/browser-session.test";
import "../src/lib/payments/runtime.test";
import "../src/lib/payments/state.test";
import "../src/lib/payments/view-contracts.test";
import "../src/lib/payments/providers/fake/adapter.test";
import "../src/lib/payments/providers/square/adapter.test";
import "../src/app/r/[slug]/menu-card-ordering.test";
import "../src/app/r/[slug]/restaurant-menu-modifiers.test";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind } from "typescript";
import { canCustomizeMenuItem, getShowcaseHref, isShowcaseCartPreview, restaurantShowcases } from "../src/lib/restaurant-showcases";
import { SUPER_TACOS_ID } from "../src/lib/demo/policy";
import { createDirectCartLine, getCardAddMode } from "../src/app/r/[slug]/menu-card-ordering";

test("browse-only items retain local cart interaction only with the explicit preview capability", () => {
  assert.equal(isShowcaseCartPreview(SUPER_TACOS_ID), true);
  assert.equal(isShowcaseCartPreview("ordinary-restaurant"), false);
  assert.equal(canCustomizeMenuItem(false), false);
  assert.equal(canCustomizeMenuItem(false, true), true);
  const item = { id: "sample", name: "Sample", description: null, price_cents: 350, image_url: null, is_orderable: false, modifierGroups: [] };
  assert.equal(getCardAddMode(item), "full");
  assert.equal(getCardAddMode(item, true), "direct");
  assert.equal(createDirectCartLine(item, { id: "sample", name: "Samples", description: null, sort_order: 0, items: [item] }, "local-line").basePriceCents, 350);
  assert.ok(restaurantShowcases.every((showcase) => !showcase.published && getShowcaseHref(showcase) === null));
  for (const routeEnabled of [false, true]) {
    for (const published of [false, true]) {
      assert.equal(getShowcaseHref({ slug: "super-tacos", routeEnabled, published }), routeEnabled && published ? "/r/super-tacos" : null);
    }
  }
});

test("fictional restaurant metadata stays noindex in Production without trusting a database flag", async () => {
  const output: { generateMetadata?: (props: unknown) => Promise<{ robots: { index: boolean; follow: boolean } }> } = {};
  runInNewContext(transpileModule(readFileSync("src/app/r/[slug]/layout.tsx", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, {
    exports: output, require(name: string) {
      if (name === "@/lib/seo/site-origin") return { isProductionSite: () => true };
      if (name === "@/lib/supabase/server") return { supabaseServer: { from() { throw new Error("Fictional noindex must not depend on a database query"); } } };
      throw new Error(`Unexpected metadata dependency: ${name}`);
    },
  });
  const metadata = await output.generateMetadata!({ params: Promise.resolve({ slug: "super-tacos" }) });
  assert.equal(metadata.robots.index, false);
  assert.equal(metadata.robots.follow, false);
});

test("direct demo favorites API stays browser-local without a database query", async () => {
  const output: { GET?: (request: Request, context: unknown) => Promise<unknown>; POST?: (request: Request, context: unknown) => Promise<unknown> } = {};
  runInNewContext(transpileModule(readFileSync("src/app/api/restaurants/[slug]/hearts/route.ts", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, {
    exports: output,
    require(name: string) {
      if (name === "next/server") return { NextResponse: { json: (body: unknown, options?: { status?: number }) => ({ body, status: options?.status ?? 200 }) } };
      if (name === "zod") return { z: { object: () => ({}), uuid: () => ({}), boolean: () => ({}) } };
      if (name === "@/lib/demo/policy") return { SUPER_TACOS_SLUG: "super-tacos" };
      if (name === "@/lib/supabase/server") return { supabaseServer: { from() { throw new Error("Demo favorites must not query Production"); } } };
      if (name.startsWith("@/lib/menu-engagement/")) return {};
      throw new Error(`Unexpected favorites dependency: ${name}`);
    },
  });
  const context = { params: Promise.resolve({ slug: "super-tacos" }) };
  assert.equal(JSON.stringify(await output.GET!(new Request("https://example.test/api/restaurants/super-tacos/hearts"), context)), JSON.stringify({ body: { likedItemIds: [] }, status: 200 }));
  assert.equal(JSON.stringify(await output.POST!(new Request("https://example.test/api/restaurants/super-tacos/hearts", { method: "POST" }), context)), JSON.stringify({ body: { error: "Demo favorites stay in this browser." }, status: 403 }));
});

test("separate Production package is hashed, new-tenant-only, nonorderable and has no operational imports", () => {
  const folder = "supabase/releases/super-tacos-public/";
  const manifest = JSON.parse(readFileSync(folder + "manifest.json", "utf8"));
  assert.equal(manifest.project, "fullaiodvmilkdxyxnln");
  for (const [file, expected] of Object.entries(manifest.artifacts)) {
    assert.equal(createHash("sha256").update(readFileSync(folder + file)).digest("hex"), expected);
  }
  for (const [file, expected] of Object.entries(manifest.sources)) {
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), expected);
  }
  const content = readFileSync(folder + "content.sql", "utf8");
  assert.doesNotMatch(content, /\bon conflict\b|\bdelete from\b|\balter table\b|\binsert into public\.(?:orders|payments|restaurant_payment_connections|payment_provider_references|restaurant_memberships|restaurant_catering_settings)\b/i);
  assert.doesNotMatch(content, /public\.(?:restaurant_payment_connections|payment_provider_references|payments|payment_attempts|refunds|restaurant_notification_settings|restaurant_catering_settings|restaurant_delivery_providers)\b/i);
  assert.match(content, /Existing restaurant: stop/);
  assert.match(content, /Reserved identity collision/);
  assert.match(content, /Production identity and verified TLS required/);
  assert.match(content, /Other-tenant content or operational fingerprint changed/);
  assert.match(content, /Production composite menu placement key missing/);
  const match = content.match(/expected jsonb := \$catalog\$([\s\S]*?)\$catalog\$::jsonb/);
  assert.ok(match);
  const expected = JSON.parse(match[1]);
  assert.equal(expected.menu_items.length, 25);
  assert.ok(expected.menu_items.every((item: { is_active: boolean }) => item.is_active));
  assert.ok(expected.menu_items.every((item: { is_orderable: boolean; source_image_url: string }) => !item.is_orderable && item.source_image_url.startsWith("/img/super-tacos/approved/")));
  assert.ok(expected.menu_section_items.every((placement: Record<string, unknown>) => !Object.hasOwn(placement, "id")));
  assert.equal(expected.restaurants[0].is_indexable, false);
  assert.equal(expected.restaurant_ordering_settings[0].pickup_enabled, false);
  assert.equal(expected.modifier_groups.length, 9);
  assert.equal(expected.modifier_options.length, 35);
  for (const file of ["schema-verify.sql", "preflight.sql", "verify.sql", "armandos-preflight.sql"]) {
    const sql = readFileSync(folder + file, "utf8");
    assert.match(sql, /serializable read only/);
    assert.doesNotMatch(sql, /\b(?:insert into|update public|delete from|alter table)\b/i);
    assert.match(sql, /rollback;/);
  }
  const schema = readFileSync(folder + "schema-prep.sql", "utf8");
  assert.match(schema, /add column is_indexable boolean not null default true/);
  assert.match(schema, /lock_timeout='2s'/);
  assert.doesNotMatch(schema, /\b(?:create table|drop table|create function|delete from|update public)\b/i);
});
