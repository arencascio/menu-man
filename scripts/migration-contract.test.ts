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
    "202609130001_canonicalize_dst_pickup_slots.sql",
    "202609130002_checkout_pickup_ux.sql",
    "202609130003_safe_checkout_abandonment.sql",
    "202609140001_order_management_foundation.sql",
    "202609140002_order_management_refinements.sql",
    "202609140003_restaurant_user_management.sql",
    "202609140004_order_management_polish_export.sql",
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
    "restaurant_capabilities",
    "restaurant_role_capability_defaults",
    "restaurant_memberships",
    "restaurant_membership_permission_overrides",
    "restaurant_access_events",
    "restaurant_refund_policies",
    "order_fulfillments",
    "order_fulfillment_events",
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
    "pickup_slot_interval_minutes",
    "advance_order_days",
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

test("checkout pickup UX migration keeps custom tips and pickup cadence server authoritative", () => {
  const migration = migrations.find(
    ({ file }) => file.endsWith("_checkout_pickup_ux.sql"),
  )?.sql || "";
  assert.match(migration, /pickup_slot_interval_minutes integer not null default 15/i);
  assert.match(migration, /pickup_slot_interval_minutes between 5 and 1440/i);
  assert.match(migration, /advance_order_days integer not null default 0/i);
  assert.match(migration, /for day_offset in -1\.\.settings_record\.advance_order_days/i);
  assert.match(migration, /make_interval\(mins => settings_record\.pickup_slot_interval_minutes\)/i);
  assert.match(migration, /alter column tip_basis_points drop not null/i);
  assert.match(migration, /p_request ->> 'tipChoice' <> 'custom'/i);
  assert.match(migration, /custom_tip_value::integer/i);
  assert.match(migration, /revoke all on function public\.create_order_base_v1[\s\S]*service_role/i);
  assert.match(migration, /grant execute on function public\.create_order_v1[\s\S]*to service_role/i);
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

test("pickup availability canonically removes repeated fall-DST wall-clock slots", () => {
  const checkout = migrations.find(({ file }) => file.endsWith("_checkout_v1.sql"))?.sql || "";
  const repair = migrations.find(
    ({ file }) => file.endsWith("_canonicalize_dst_pickup_slots.sql"),
  )?.sql || "";

  for (const definition of [checkout, repair]) {
    assert.match(
      definition,
      /distinct on \(slot at time zone restaurant_record\.timezone\)[\s\S]*order by \(slot at time zone restaurant_record\.timezone\), slot[\s\S]*where canonical_slot\.slot >= p_now/i,
    );
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

test("safe checkout abandonment is capability protected and serialized with payment attempts", () => {
  const migration = migrations.find(
    ({ file }) => file.endsWith("_safe_checkout_abandonment.sql"),
  )?.sql || "";
  assert.match(migration, /create or replace function public\.abandon_checkout_v1/i);
  assert.match(migration, /session\.access_token_hash = p_access_token_hash/i);
  assert.match(migration, /for update of payment/i);
  assert.match(migration, /from public\.payment_attempts attempt[\s\S]*attempt\.payment_id = payment_record\.id/i);
  assert.match(migration, /cancellation_reason = 'checkout_abandoned'/i);
  assert.match(migration, /set revoked_at = coalesce\(revoked_at, now\(\)\)/i);
  assert.match(migration, /'checkout\.abandoned'/i);
  assert.match(migration, /revoke all on function public\.abandon_checkout_v1\(uuid, text\)[\s\S]*service_role/i);
  assert.match(migration, /grant execute on function public\.abandon_checkout_v1\(uuid, text\) to service_role/i);
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

test("order management is tenant-scoped, capability-based, and financially isolated", () => {
  const migration = migrations.find(
    ({ file }) => file.endsWith("_order_management_foundation.sql"),
  )?.sql || "";
  for (const capability of [
    "view_orders", "advance_fulfillment", "view_customer_contact",
    "export_order_history", "issue_refunds", "correct_fulfillment",
    "manage_memberships",
  ]) assert.match(migration, new RegExp(`'${capability}'`, "i"));
  for (const functionName of [
    "list_my_restaurant_memberships_v1", "list_managed_orders_v1",
    "get_managed_order_detail_v1", "list_managed_order_export_rows_v1",
    "transition_order_fulfillment_v1",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${functionName}\\b`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*to authenticated`, "i"));
    assert.match(migration, new RegExp(`revoke all on function public\\.${functionName}[\\s\\S]*from public, anon, authenticated`, "i"));
  }
  assert.match(migration, /status in \('new', 'preparing', 'ready', 'completed'\)/i);
  assert.doesNotMatch(migration, /fulfillment[^\n]*accepted/i);
  assert.match(migration, /fulfillment_record\.version <> p_expected_version/i);
  assert.match(migration, /actor_user_id uuid references auth\.users/i);
  assert.match(migration, /restaurant_access_events/i);
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete)[\s\S]*public\.orders[\s\S]*to authenticated/i);
  assert.match(migration, /private\.require_restaurant_capability_v1\(p_restaurant_slug, 'view_orders'\)/i);
  assert.match(migration, /private\.require_restaurant_capability_v1\(p_restaurant_slug, 'advance_fulfillment'\)/i);
  assert.match(migration, /limit p_limit \+ 1/i);
  assert.match(migration, /refund_window_days integer not null default 7/i);
  assert.match(migration, /p_restaurant_slug, 'export_order_history'/i);
  assert.match(migration, /realtime\.send\([\s\S]*'order_changed'/i);
});

test("order management routes expose login but no public signup", () => {
  const login = readFileSync(join(process.cwd(), "src", "app", "manage", "login", "LoginForm.tsx"), "utf8");
  const server = readFileSync(join(process.cwd(), "src", "lib", "order-management", "server.ts"), "utf8");
  assert.match(login, /signInWithPassword/i);
  assert.doesNotMatch(login, /signUp\s*\(/i);
  assert.match(server, /auth\.getClaims\(\)/i);
  assert.doesNotMatch(server, /supabaseServer/i);
});

test("order management refinement quarantines backfill and uses placed-time history", () => {
  const migration = migrations.find(
    ({ file }) => file.endsWith("_order_management_refinements.sql"),
  )?.sql || "";
  assert.match(migration, /event\.metadata ->> 'source' = 'migration_backfill'/i);
  assert.match(migration, /where fulfillment\.status <> 'completed'/i);
  assert.match(migration, /set status = 'completed'/i);
  assert.match(migration, /p_view = 'active'[\s\S]*fulfillment\.status <> 'completed'/i);
  assert.match(migration, /'preservedOriginalBackfill', true/i);
  assert.match(migration, /p_date_basis text default 'placed'/i);
  assert.match(migration, /when 'pickup' then order_record\.pickup_at[\s\S]*else coalesce\(order_record\.placed_at, order_record\.created_at\)/i);
  assert.match(migration, /item_count integer/i);
  assert.match(migration, /total_cents integer/i);
  assert.match(migration, /'correct_fulfillment'/i);
  assert.match(migration, /action <> 'fulfillment\.corrected'[\s\S]*btrim\(coalesce\(reason, ''\)\) <> ''/i);
  assert.doesNotMatch(migration, /delete from public\.order_fulfillment_events/i);
});

test("restaurant user management is database-authorized, audited, and last-owner safe", () => {
  const migration = migrations.find(
    ({ file }) => file.endsWith("_restaurant_user_management.sql"),
  )?.sql || "";
  assert.match(migration, /status in \('invited', 'active', 'revoked'\)/i);
  for (const functionName of [
    "authorize_restaurant_member_invite_v1", "provision_restaurant_member_v1",
    "update_restaurant_member_v1", "revoke_restaurant_member_v1",
    "reinstate_restaurant_member_v1", "reserve_restaurant_invitation_resend_v1",
    "record_restaurant_invitation_resend_result_v1",
    "activate_my_restaurant_memberships_v1", "list_restaurant_team_v1",
    "list_restaurant_access_events_v1",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${functionName}\\b`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*to authenticated`, "i"));
  }
  assert.match(migration, /You cannot grant a permission you do not have/i);
  assert.match(migration, /Only an owner can manage owners/i);
  assert.match(migration, /final active owner cannot be (?:demoted|revoked)/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /actor_membership_id uuid/i);
  assert.match(migration, /unique \(restaurant_id, client_action_id\)/i);
  assert.match(migration, /membership\.invitation_resent/i);
  assert.match(migration, /membership\.activated/i);
  assert.match(migration, /private\.replace_membership_capabilities_v1/i);
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete)[\s\S]*restaurant_memberships[\s\S]*to authenticated/i);
});

test("order history export is capability-gated, tenant-scoped, redacted, and cursor bounded", () => {
  const migration = migrations.find(
    ({ file }) => file.endsWith("_order_management_polish_export.sql"),
  )?.sql || "";
  assert.match(migration, /private\.require_restaurant_capability_v1\([\s\S]*'export_order_history'/i);
  assert.match(migration, /p_date_basis not in \('placed', 'pickup'\)/i);
  assert.match(migration, /case when access_record\.can_view_contact[\s\S]*customer_name else null end/i);
  assert.match(migration, /fulfillment\.restaurant_id = access_record\.restaurant_id/i);
  assert.match(migration, /fulfillment\.status = 'completed'/i);
  assert.match(migration, /sum\(item\.quantity\)::integer/i);
  assert.match(migration, /p_cursor_at[\s\S]*p_cursor_order_id/i);
  assert.match(migration, /limit p_limit \+ 1/i);
  assert.match(migration, /grant execute on function public\.list_managed_order_export_rows_v1[\s\S]*to authenticated/i);
});

test("staging fixture values never appear in schema migrations", () => {
  assert.doesNotMatch(completeSchema, /\barmandos\b/i);
  assert.doesNotMatch(completeSchema, /\b875\b/);
  assert.doesNotMatch(completeSchema, /time '07:00'/i);
});
