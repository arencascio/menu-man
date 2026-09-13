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
    "202609110001_fix_checkout_request_fingerprint_ambiguity.sql",
    "202609110002_route_based_checkout.sql",
    "202609110003_fix_terminal_payment_failure_transition.sql",
    "202609110004_fake_payment_exception_controls.sql",
    "202609120001_square_adapter_support.sql",
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

test("checkout fingerprint references are unambiguous in bootstrap and forward repair", () => {
  const checkout = migrations.find(({ file }) => file.endsWith("_checkout_v1.sql"))?.sql || "";
  const repair = migrations.find(
    ({ file }) => file.endsWith("_fix_checkout_request_fingerprint_ambiguity.sql"),
  )?.sql || "";

  for (const definition of [checkout, repair]) {
    assert.match(definition, /\bv_request_fingerprint\s+text\s*;/i);
    assert.match(definition, /v_request_fingerprint\s*:=\s*pg_catalog\.encode/i);
    assert.match(definition, /select\s+o\.id\s*,\s*o\.request_fingerprint[\s\S]*from\s+public\.orders\s+o/i);
    assert.match(definition, /existing_order\.request_fingerprint\s*<>\s*v_request_fingerprint/i);
    assert.match(definition, /lower\(p_idempotency_key\)\s*,\s*v_request_fingerprint\s*,/i);
    assert.doesNotMatch(definition, /\n\s*request_fingerprint\s+text\s*;/i);
  }
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

test("route checkout adds a capability-protected snapshot and terminal failure guard", () => {
  const migration = migrations.find(({ file }) => file.endsWith("_route_based_checkout.sql"))?.sql || "";
  const repair = migrations.find(
    ({ file }) => file.endsWith("_fix_terminal_payment_failure_transition.sql"),
  )?.sql || "";
  assert.match(migration, /create or replace function public\.get_order_payment_view_v1/i);
  assert.match(migration, /session\.access_token_hash = p_access_token_hash/i);
  assert.match(migration, /restaurant\.slug = p_restaurant_slug/i);
  assert.match(migration, /create trigger payment_attempt_terminal_failure/i);
  assert.match(migration, /'payment_declined'/i);
  assert.match(migration, /'payment_failed'/i);
  assert.match(migration, /order_status = 'cancelled'/i);
  assert.match(migration, /grant execute on function public\.get_order_payment_view_v1[\s\S]*to service_role/i);

  for (const definition of [migration, repair]) {
    assert.match(definition, /'reconciliation',\s*\n\s*'payment\.terminal_failure'/i);
    assert.doesNotMatch(definition, /'system',\s*\n\s*'payment\.terminal_failure'/i);
  }
});

test("fake exceptional-state controls are capability protected and test-only", () => {
  const migration = migrations.find(
    ({ file }) => file.endsWith("_fake_payment_exception_controls.sql"),
  )?.sql || "";
  for (const functionName of [
    "reserve_fake_authorization_action_v1",
    "reserve_fake_late_success_resolution_v1",
    "accept_fake_late_success_v1",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${functionName}\\b`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*to service_role`, "i"));
  }
  assert.match(migration, /session\.access_token_hash = p_access_token_hash/i);
  assert.match(migration, /connection_record\.provider_key <> 'fake'/i);
  assert.match(migration, /connection_record\.environment <> 'test'/i);
  assert.match(migration, /'authorization_voided'/i);
  assert.match(migration, /'payment_late_success'/i);
  assert.doesNotMatch(migration, /insert into public\.payment_attempts/i);
});

test("real-provider support keeps reconciliation and refund correlation restricted", () => {
  const migration = migrations.find(
    ({ file }) => file.endsWith("_square_adapter_support.sql"),
  )?.sql || "";
  for (const functionName of [
    "record_refund_command_result_v1",
    "ingest_payment_reconciliation_v1",
    "touch_payment_reconciliation_v1",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${functionName}\\b`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*to service_role`, "i"));
    assert.match(migration, new RegExp(`revoke all on function public\\.${functionName}[\\s\\S]*from public, anon, authenticated`, "i"));
  }
  assert.match(migration, /event_source in \('webhook', 'reconciliation'\)/i);
  assert.match(migration, /event_source = 'webhook' and signature_verified/i);
  assert.match(migration, /event_source = 'reconciliation' and not signature_verified/i);
  assert.match(migration, /set source = 'reconciliation'/i);
});

test("Square staging bootstrap stores only provider references, never Square secrets", () => {
  const seed = readFileSync(
    join(process.cwd(), "supabase", "seeds", "staging", "005_armandos_square_sandbox.sql"),
    "utf8",
  );
  assert.match(seed, /provider_key[\s\S]*'square'/i);
  assert.match(seed, /environment[\s\S]*'sandbox'/i);
  assert.match(seed, /reference_kind[\s\S]*'location'/i);
  assert.match(seed, /vercel-env:SQUARE_SANDBOX_ACCESS_TOKEN/i);
  assert.doesNotMatch(seed, /sandbox_access_token\s*[,)]/i);
  assert.doesNotMatch(seed, /webhook_signature_key\s*[,)]/i);
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
