import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20261026075607_conditional_modifier_groups.sql", "utf8").replaceAll("\r\n", "\n");
const original = readFileSync("supabase/migrations/202609110001_fix_checkout_request_fingerprint_ambiguity.sql", "utf8").replaceAll("\r\n", "\n");

const pendingMigration = "20261026075607_conditional_modifier_groups.sql";
const migrations = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort()
  .map((file) => ({ file, sql: readFileSync(`supabase/migrations/${file}`, "utf8").replaceAll("\r\n", "\n") }));

type CheckoutDefinition = { signature: string; definition: string; origin: string; history: string[]; roles: Set<string> };

// Static DDL lineage, not database execution. Track CREATE/REPLACE, RENAME and
// function ACLs in order, so a later redefinition cannot hide behind the old copy.
function checkoutLineage(includePending: boolean) {
  const functions = new Map<string, CheckoutDefinition>();
  for (const migration of migrations) {
    if (!includePending && migration.file >= pendingMigration) break;
    const events: Array<{ index: number; apply: () => void }> = [];
    for (const match of migration.sql.matchAll(/create(?: or replace)? function (public\.create_order\w*)\s*\(([\s\S]*?)\)\s*returns[\s\S]*?\bas (\$\w*\$)[\s\S]*?\3\s*;/gi)) {
      const [, name, args] = match;
      const signature = [...args.matchAll(/p_\w+\s+(\w+)/g)].map((arg) => arg[1]).join(", ");
      events.push({ index: match.index!, apply: () => {
        const prior = functions.get(name);
        if (prior) assert.equal(signature, prior.signature, `Changed signature: ${name}`);
        functions.set(name, { signature, definition: match[0], origin: migration.file,
          history: [...prior?.history ?? [], `${migration.file}: define ${name}`], roles: new Set(prior?.roles ?? ["public"]) });
      } });
    }
    for (const match of migration.sql.matchAll(/alter function (public\.create_order\w*)\(([^)]*)\)\s*rename to (create_order\w*)\s*;/gi)) {
      events.push({ index: match.index!, apply: () => {
        const prior = functions.get(match[1]);
        assert.ok(prior, `Missing rename source ${match[1]}`);
        assert.equal(prior.signature, match[2].replace(/\s+/g, " ").trim());
        functions.delete(match[1]);
        functions.set(`public.${match[3]}`, { ...prior, history: [...prior.history, `${migration.file}: rename ${match[1]} to ${match[3]}`] });
      } });
    }
    for (const match of migration.sql.matchAll(/(revoke all|grant execute) on function (public\.create_order\w*)\(([^)]*)\)\s*(?:from|to) ([\w,\s]+);/gi)) {
      events.push({ index: match.index!, apply: () => {
        const fn = functions.get(match[2]);
        assert.ok(fn, `Missing ACL target ${match[2]}`);
        assert.equal(fn.signature, match[3].replace(/\s+/g, " ").trim());
        for (const role of match[4].split(",").map((name) => name.trim())) {
          if (match[1].toLowerCase() === "revoke all") fn.roles.delete(role);
          else fn.roles.add(role);
        }
      } });
    }
    for (const event of events.sort((a, b) => a.index - b.index)) event.apply();
  }
  return functions;
}

function body(definition: string) {
  return definition.slice(definition.indexOf("as $$") + 5, definition.lastIndexOf("$$;")).trim();
}

test("effective pre-migration core is the September 11 body renamed twice, without later replacement", () => {
  const core = checkoutLineage(false).get("public.create_order_core_v1")!;
  assert.equal(core.origin, "202609110001_fix_checkout_request_fingerprint_ambiguity.sql");
  assert.deepEqual(core.history, [
    "202609080007_checkout_v1.sql: define public.create_order_v1",
    "202609110001_fix_checkout_request_fingerprint_ambiguity.sql: define public.create_order_v1",
    "202609130002_checkout_pickup_ux.sql: rename public.create_order_v1 to create_order_base_v1",
    "202609160002_checkout_customer_requirements.sql: rename public.create_order_base_v1 to create_order_core_v1",
  ]);
  assert.equal(body(core.definition), body(original));
});

test("pending migration preserves every effective checkout wrapper, signature and execute privilege", () => {
  const before = checkoutLineage(false);
  const after = checkoutLineage(true);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort());
  for (const [name, prior] of before) {
    const next = after.get(name)!;
    assert.equal(next.signature, prior.signature, name);
    assert.deepEqual(next.roles, prior.roles, name);
    if (name !== "public.create_order_core_v1") assert.equal(next.definition, prior.definition, name);
  }
  for (const name of ["create_order_v1", "create_order_with_abuse_limit_v1"]) {
    assert.deepEqual(after.get(`public.${name}`)!.roles, new Set(["service_role"]));
  }
  for (const name of ["create_order_core_v1", "create_order_base_v1", "create_order_unlocked_v1", "create_order_before_exact_replay_v1"]) {
    assert.deepEqual(after.get(`public.${name}`)!.roles, new Set());
  }
});

test("effective new-order call chain retains replay, pickup lock/recheck, custom tips and customer normalization", () => {
  const effective = checkoutLineage(true);
  const chain = ["create_order_with_abuse_limit_v1", "create_order_v1", "create_order_before_exact_replay_v1",
    "create_order_unlocked_v1", "create_order_base_v1", "create_order_core_v1"];
  for (let index = 0; index < chain.length - 1; index++) {
    assert.ok(effective.get(`public.${chain[index]}`)!.definition.includes(`public.${chain[index + 1]}(`));
  }
  const at = (name: string) => effective.get(`public.${name}`)!.definition;
  assert.match(at("create_order_with_abuse_limit_v1"), /MM_CHECKOUT_RATE_LIMITED/);
  assert.match(at("create_order_with_abuse_limit_v1"), /retry_seconds := greatest\(/);
  assert.match(at("create_order_v1"), /MM_IDEMPOTENCY_CONFLICT/);
  assert.match(at("create_order_v1"), /normalize_checkout_customer_name_v1/);
  assert.match(at("create_order_before_exact_replay_v1"), /pg_advisory_xact_lock_shared/);
  assert.match(at("create_order_before_exact_replay_v1"), /get_pickup_availability_v1\([\s\S]*pg_catalog.clock_timestamp\(\)/);
  assert.match(at("create_order_unlocked_v1"), /maximum_custom_tip := authoritative_subtotal \+ additive_tip_cap/);
  assert.match(at("create_order_unlocked_v1"), /MM_LARGE_TIP_CONFIRMATION_REQUIRED/);
  assert.match(at("create_order_base_v1"), /settings.customer_name_required/);
  assert.match(at("create_order_base_v1"), /private.normalize_checkout_notes_v1/);
});

test("migration follows its dependencies and cannot overwrite later helpers, triggers or checkout wrappers", () => {
  assert.ok(migrations.some(({ file }) => file === pendingMigration));
  assert.equal(migrations.at(-1)!.file, "20261026175758_conditional_modifier_write_isolation.sql");
  const before = migrations.filter(({ file }) => file < pendingMigration).map(({ sql }) => sql).join("\n");
  assert.match(before, /create schema if not exists private/);
  assert.match(before, /unique \(restaurant_id, menu_item_id, modifier_group_id\)/);
  assert.match(before, /unique \(restaurant_id, modifier_group_id, id\)/);
  assert.deepEqual([...sql.matchAll(/create(?: or replace)? function ([\w.]+)/g)].map((match) => match[1]), [
    "private.enforce_modifier_depth_v1", "private.modifier_attachment_active_v1", "public.create_order_core_v1",
  ]);
  assert.deepEqual([...sql.matchAll(/create trigger (\w+)/g)].map((match) => match[1]), ["enforce_modifier_depth_v1"]);
  assert.doesNotMatch(sql, /drop function|drop trigger|alter function|alter table public\.(?:orders|order_items|order_item_modifiers)\b/i);
  assert.match(sql, /revoke all on function private\.modifier_attachment_active_v1\(uuid, uuid, uuid, jsonb\)\s+from public, anon, authenticated, service_role;/);
  assert.match(sql, /revoke all on function private\.enforce_modifier_depth_v1\(\) from public, anon, authenticated, service_role;/);
  const core = checkoutLineage(true).get("public.create_order_core_v1")!.definition;
  assert.match(core, /returns jsonb\s+language plpgsql\s+security definer\s+set search_path = ''/);
  assert.ok(core.indexOf("private.modifier_attachment_active_v1(") < core.indexOf("into modifier_total"));
  assert.ok(core.indexOf("MM_INVALID_MODIFIERS|A selected modifier") < core.indexOf("insert into public.orders"));
});

test("conditional migration preserves the complete existing order transaction except activation checks", () => {
  const body = sql.slice(sql.indexOf("create or replace function public.create_order_core_v1("), sql.lastIndexOf("revoke all on function public.create_order_core_v1")).trim();
  const restored = body.replace("public.create_order_core_v1(", "public.create_order_v1(")
    .replace("\n      and private.modifier_attachment_active_v1(\n        attachment.restaurant_id, attachment.menu_item_id, attachment.modifier_group_id,\n        line_entry.line -> 'modifierOptionIds')", "")
    .replace("\n        and private.modifier_attachment_active_v1(\n          attachment.restaurant_id, attachment.menu_item_id, attachment.modifier_group_id,\n          line_entry.line -> 'modifierOptionIds')", "");
  assert.equal(restored, original.slice(original.indexOf("create or replace function public.create_order_v1("), original.lastIndexOf("commit;")).trim());
});

test("database contract rejects inactive children before pricing and gates required child validation", () => {
  const eligibility = sql.slice(sql.indexOf("    select count(*)\n    into valid_selected_count"), sql.indexOf("    select coalesce(sum("));
  assert.match(eligibility, /modifier_attachment_active_v1/);
  assert.match(eligibility, /if valid_selected_count <> selected_count then/);
  assert.match(eligibility, /MM_INVALID_MODIFIERS/);
  assert.equal(eligibility.match(/private\.modifier_attachment_active_v1/g)?.length, 2);
  assert.match(sql, /parent\.parent_modifier_group_id is null and parent\.is_active/);
  assert.match(sql, /parent_option\.is_active/);
  assert.match(sql, /coalesce\(parent_override\.is_active, true\)/);
  assert.match(sql, /p_selected \? parent_option\.id::text/);
});

test("database relationships enforce same tenant, same item, correct parent option and one nesting level", () => {
  assert.match(sql, /foreign key \(restaurant_id, menu_item_id, parent_modifier_group_id\)/);
  assert.match(sql, /foreign key \(restaurant_id, parent_modifier_group_id, parent_modifier_option_id\)/);
  assert.match(sql, /parent_modifier_group_id is distinct from modifier_group_id/);
  assert.match(sql, /parent\.parent_modifier_group_id is null/);
  assert.match(sql, /child\.parent_modifier_group_id = new\.modifier_group_id/);
  assert.match(sql, /for update/);
  assert.doesNotMatch(sql, /grant execute/);
});
