import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const migrations = migrationFiles.map((file) => ({
  file,
  sql: readFileSync(join(migrationDirectory, file), "utf8"),
}));
const completeSchema = migrations.map(({ sql }) => sql).join("\n");

test("clean-environment migrations have one deterministic ordered sequence", () => {
  assert.deepEqual(migrationFiles, [
    "202609080001_extensions.sql",
    "202609080002_core_catalog.sql",
    "202609080003_restaurant_profile_hours.sql",
    "202609080004_menu_source_and_assets.sql",
    "202609080005_restaurant_presentation.sql",
    "202609080006_ordering_schema.sql",
    "202609080007_checkout_v1.sql",
    "202609100001_payments_foundation.sql",
  ]);
});

test("baseline creates every documented application table", () => {
  const tables = [
    "restaurants",
    "menus",
    "menu_sections",
    "menu_items",
    "menu_section_items",
    "restaurant_business_hours",
    "modifier_groups",
    "modifier_options",
    "menu_item_modifier_groups",
    "menu_item_modifier_option_overrides",
    "orders",
    "order_items",
    "order_item_modifiers",
    "restaurant_ordering_settings",
    "restaurant_order_counters",
    "restaurant_payment_connections",
    "payment_provider_references",
    "payments",
    "payment_checkout_sessions",
    "payment_attempts",
    "payment_webhook_events",
    "refunds",
    "payment_state_transitions",
    "analytics_outbox",
  ];

  for (const table of tables) {
    assert.match(completeSchema, new RegExp(`create table(?: if not exists)? public\\.${table}\\b`, "i"));
    assert.match(completeSchema, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
});

test("baseline contains required source, image, theme, SEO, and ordering fields", () => {
  for (const field of [
    "source_system",
    "source_item_id",
    "source_image_url",
    "image_path",
    "theme_preset",
    "theme_overrides",
    "primary_domain",
    "is_orderable",
    "is_default",
    "request_fingerprint",
    "pickup_timezone",
    "tax_rate_basis_points",
  ]) {
    assert.match(completeSchema, new RegExp(`\\b${field}\\b`, "i"));
  }
});

test("menu item placement uniqueness is section-scoped", () => {
  const catalog = migrations.find(({ file }) => file.endsWith("_core_catalog.sql"))?.sql || "";
  assert.match(
    catalog,
    /constraint menu_section_items_section_item_key unique \(section_id, item_id\)/i,
  );
  assert.doesNotMatch(catalog, /unique \(item_id\)/i);
});

test("checkout functions and restricted service-role boundary are present", () => {
  const checkout = migrations.find(({ file }) => file.endsWith("_checkout_v1.sql"))?.sql || "";
  assert.match(checkout, /create or replace function public\.get_pickup_availability_v1/i);
  assert.match(checkout, /create or replace function public\.create_order_v1/i);
  assert.match(checkout, /security definer/i);
  assert.match(checkout, /'pending_payment'/);
  assert.match(checkout, /'unpaid'/);
  assert.match(checkout, /revoke insert, update, delete on table[\s\S]*public\.orders[\s\S]*from service_role/i);
  assert.match(checkout, /grant execute on function public\.create_order_v1[\s\S]*to service_role/i);
});

test("payment state is mutated only through restricted functions", () => {
  const payments = migrations.find(({ file }) => file.endsWith("_payments_foundation.sql"))?.sql || "";
  for (const functionName of [
    "prepare_payment_v1",
    "authorize_payment_session_v1",
    "reserve_payment_attempt_v1",
    "record_payment_command_result_v1",
    "ingest_payment_webhook_v1",
    "apply_payment_event_v1",
    "expire_payment_v1",
    "reserve_refund_v1",
  ]) {
    assert.match(payments, new RegExp(`create or replace function public\\.${functionName}\\b`, "i"));
    assert.match(payments, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*to service_role`, "i"));
  }
  assert.match(payments, /revoke insert, update, delete on table[\s\S]*public\.payments[\s\S]*from service_role/i);
  assert.match(payments, /unique \(\s*provider_key, environment, provider_event_id\s*\)/i);
  assert.match(payments, /provider_key <> 'fake' or environment = 'test'/i);
  assert.match(payments, /'purchase', 'payment', payment_record\.id/i);
});

test("browser analytics cannot emit purchase", () => {
  const analyticsTypes = readFileSync(join(process.cwd(), "src", "lib", "analytics", "types.ts"), "utf8");
  const analyticsClient = readFileSync(join(process.cwd(), "src", "lib", "analytics", "client.ts"), "utf8");
  assert.doesNotMatch(analyticsTypes, /name:\s*"purchase"/);
  assert.doesNotMatch(analyticsClient, /event\.name === "purchase"/);
});

test("staging fixture values never appear in schema migrations", () => {
  assert.doesNotMatch(completeSchema, /\barmandos\b/i);
  assert.doesNotMatch(completeSchema, /\b875\b/);
  assert.doesNotMatch(completeSchema, /time '07:00'/i);
});
