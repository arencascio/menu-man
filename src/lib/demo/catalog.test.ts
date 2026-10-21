import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import catalog from "../../../supabase/seeds/staging/super-tacos-demo.json";
import installed from "../../../supabase/qa/super-tacos-installed-catalog-v1.json";
import { createMenuModifierGroupResolver } from "@/app/r/[slug]/restaurant-menu-modifiers";
import { calculateCartSubtotalCents, createModifierSelections, getDefaultModifierOptionIds, getModifierValidationErrors } from "../cart/cart";
import { getCateringChoiceValue, getCateringRequestSelections } from "./catering-preview";
import { superTacosContent } from "./showcase-content";
import { superTacosShowcase } from "./presentation";

const id = (number: number) => `20000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const groups = catalog.modifierGroups.map((group) => ({ id: id(500 + group.number), name: group.name, description: null, is_active: true }));
const options = catalog.modifierGroups.flatMap((group) => group.options.map((option, index) => ({
  id: id(600 + option.number), modifier_group_id: id(500 + group.number), name: option.name,
  default_price_adjustment_cents: option.price, sort_order: index, is_default: "default" in option && option.default === true, is_active: true,
})));
const attachments = catalog.items.flatMap((item) => item.groups.map((number, index) => {
  const group = catalog.modifierGroups.find((group) => group.number === number)!;
  return { menu_item_id: id(200 + item.number), modifier_group_id: id(500 + number), min_selections: group.min, max_selections: group.max, sort_order: index, is_active: true };
}));
const resolve = createMenuModifierGroupResolver(groups, options, attachments, []);

test("C.3 retains installed identities and adds nine noncolliding items", () => {
  assert.equal(catalog.items.length, 25);
  assert.equal(catalog.retiredItems.length, 18);
  assert.equal(new Set([...catalog.items.map((item) => item.number), ...catalog.retiredItems.map((item) => item.number)]).size, 43);
  assert.deepEqual(catalog.items.filter((item) => item.number >= 35).map((item) => item.number), [35, 36, 37, 38, 39, 40, 41, 42, 43]);
  for (const old of installed.items) {
    const retained = catalog.items.find((item) => item.number === old.number);
    if (retained) assert.equal(retained.key, old.key);
    else {
      const mapping = catalog.retiredItems.find((item) => item.number === old.number)!;
      assert.ok(mapping);
      if (mapping.replacement === null) {
        assert.match(mapping.reason, /No approved photograph accurately represents/);
        continue;
      }
      const next = catalog.items.find((item) => item.number === mapping.replacement)!;
      assert.ok(next);
      assert.ok(catalog.modifierGroups.some((group) => next.groups.includes(group.number) && group.options.some((option) => option.number === mapping.option)));
    }
  }
});

test("every active C.3 menu item has a packaged approved dish photograph", () => {
  assert.equal(catalog.items.length, 25);
  assert.ok(catalog.items.every((item) => item.imageUrl && existsSync(`public${item.imageUrl}`)));
});

test("C.3 preserves prior active IDs, prices and modifier relationships", () => {
  const expected = new Map<number, { price: number; groups: number[] }>([
    [1, { price: 350, groups: [5, 1, 3, 2] }], [4, { price: 1295, groups: [1, 2] }],
    [5, { price: 1095, groups: [6, 1, 2] }], [6, { price: 895, groups: [1, 2] }],
    [8, { price: 945, groups: [7, 1, 2] }], [9, { price: 845, groups: [7, 1, 2] }],
    [10, { price: 695, groups: [] }], [21, { price: 1045, groups: [8, 1, 2] }],
    [24, { price: 995, groups: [1, 2] }], [27, { price: 450, groups: [1] }],
    [28, { price: 595, groups: [9] }], [29, { price: 395, groups: [] }],
    [31, { price: 395, groups: [4] }], [32, { price: 1295, groups: [2] }],
    [33, { price: 995, groups: [1] }], [34, { price: 1095, groups: [] }],
  ]);
  for (const item of catalog.items) {
    const previous = installed.items.find((old) => old.number === item.number);
    if (previous) assert.equal(item.key, previous.key);
    const retainedContent = expected.get(item.number);
    if (!retainedContent) continue;
    assert.equal(item.price, retainedContent.price);
    assert.deepEqual(item.groups, retainedContent.groups);
  }
});

test("new dishes, section identity, and signature taco configuration match the approved catalog", () => {
  assert.equal(catalog.sections.find((section) => section.number === 103)?.name, "Clásicos Mexicanos");
  assert.equal(catalog.items.find((item) => item.number === 4)?.name, "Super Burrito");
  const expected = [
    [35, "Sopes", 103, 1095, [1, 2], "sopes"],
    [36, "Huevos Divorciados", 105, 1195, [], "huevos-divorciados"],
    [37, "Ranchero Plate", 103, 1295, [], "ranchero-plate"],
    [38, "Fish Taco", 101, 525, [3, 1], "fish-taco"],
    [39, "Menudo", 103, 1395, [], "menudo"],
    [40, "Mexican Coke", 104, 425, [], "mexican-coke"],
    [41, "Shrimp Cocktail", 103, 1495, [], "shrimp-cocktail"],
    [42, "Tortillas", 104, 295, [3], "tortillas"],
    [43, "Super Taco", 101, 795, [5, 1], "super-taco"],
  ] as const;
  for (const [number, name, section, price, groupNumbers, image] of expected) {
    const item = catalog.items.find((candidate) => candidate.number === number);
    assert.ok(item);
    assert.equal(item.name, name);
    assert.equal(item.section, section);
    assert.equal(item.price, price);
    assert.deepEqual(item.groups, groupNumbers);
    assert.equal(item.imageUrl, `/img/super-tacos/approved/${image}.webp`);
    assert.ok(existsSync(`public${item.imageUrl}`));
  }
  const signature = resolve(id(243));
  assert.equal(signature.find((group) => group.id === id(505))?.minSelections, 1);
  assert.ok(getModifierValidationErrors(signature, getDefaultModifierOptionIds(signature)).has(id(505)));
});

test("gallery references retain canonical identities across the installed and proposed catalog names", () => {
  assert.equal(superTacosShowcase.gallery.slides.length, 5);
  for (const slide of superTacosShowcase.gallery.slides) {
    assert.ok(installed.items.some((item) => id(200 + item.number) === slide.menuItemId));
    assert.ok(catalog.items.some((item) => id(200 + item.number) === slide.menuItemId && item.imageUrl));
  }
});

test("required filling groups have no inferred default; salsa, tortilla and extras remain separate", () => {
  for (const number of [1, 5, 8, 9, 21]) {
    const item = catalog.items.find((item) => item.number === number)!;
    const resolved = resolve(id(200 + number));
    const filling = resolved[0];
    assert.equal(filling.minSelections, 1);
    assert.equal(filling.maxSelections, 1);
    assert.ok(filling.options.every((option) => !option.isDefault));
    const defaults = getDefaultModifierOptionIds(resolved);
    assert.ok(getModifierValidationErrors(resolved, defaults).has(filling.id));
    defaults.add(filling.options[0].id);
    assert.equal(getModifierValidationErrors(resolved, defaults).size, 0);
    defaults.add(filling.options[1].id);
    assert.ok(getModifierValidationErrors(resolved, defaults).has(filling.id));
    assert.equal(item.groups.includes(1), true);
  }
  assert.equal(resolve(id(201)).find((group) => group.id === id(501))?.minSelections, 0);
  assert.equal(resolve(id(201)).find((group) => group.id === id(502))?.maxSelections, 3);
  assert.ok(resolve(id(201)).some((group) => group.id === id(503)));
  assert.deepEqual(resolve("10000000-0000-4000-8000-000000000201"), []);
});

test("canonical modifier prices flow through the existing cart calculations", () => {
  const taco = catalog.items.find((item) => item.number === 1)!;
  const resolved = resolve(id(201));
  const choices = getDefaultModifierOptionIds(resolved);
  choices.add(id(617)); // Premium shrimp +$1.25.
  choices.add(id(604)); // Guacamole +$1.50.
  choices.delete(id(607)); choices.add(id(608)); // Flour +$0.25.
  const line = { lineId: "line", menuItemId: id(201), sectionId: id(101), sectionName: "Tacos", itemName: taco.name,
    quantity: 2, basePriceCents: taco.price, selectedModifiers: createModifierSelections(resolved, choices), specialInstructions: "" };
  assert.equal(calculateCartSubtotalCents([line]), 1300);
  const asada = new Set(choices); asada.delete(id(617)); asada.add(id(611));
  assert.equal(calculateCartSubtotalCents([{ ...line, selectedModifiers: createModifierSelections(resolved, asada) }]), 1100);
  const priceByName = (number: number, name: string) => {
    const item = catalog.items.find((item) => item.number === number)!;
    const resolved = resolve(id(200 + number));
    const choices = getDefaultModifierOptionIds(resolved);
    choices.add(resolved[0].options.find((option) => option.name === name)!.id);
    return item.price + createModifierSelections(resolved, choices).reduce((sum, choice) => sum + choice.priceAdjustmentCents, 0);
  };
  assert.equal(priceByName(5, "Grilled chicken"), 1195);
  assert.equal(priceByName(5, "Grilled shrimp"), 1445);
  assert.equal(priceByName(9, "Grilled chicken"), 1145);
  assert.equal(priceByName(21, "Steak & eggs"), 1295);
  assert.equal(priceByName(28, "Six churros"), 995);
});

test("all three taco trays prefill independently, including duplicate fillings, with fixed sample prices", () => {
  const taco = superTacosContent.catering.packages[0];
  assert.equal(taco.priceCents, 18000);
  const trays = taco.choices.filter((choice) => choice.label.includes("10 tacos"));
  assert.equal(trays.length, 3);
  const values = Object.fromEntries(trays.map((choice) => [choice.label, "Carnitas"]));
  const summary = getCateringRequestSelections(taco.choices, values);
  for (const tray of trays) assert.ok(summary.includes(`${tray.label}: Carnitas`));
  assert.equal(getCateringChoiceValue(trays[0], "Unconfigured filling"), "Carne asada");
  assert.equal(superTacosContent.catering.packages[1].choices.filter((choice) => choice.label.includes("6 burritos")).length, 2);
  assert.equal(superTacosContent.catering.packages[2].choices.filter((choice) => choice.label.includes("15 rolled tacos")).length, 2);
  assert.deepEqual(superTacosContent.catering.packages.map((item) => item.priceCents), [18000, 16800, 22500]);
});

test("every active fixture item has an approved photograph; historical photo records remain explicit", () => {
  assert.ok(catalog.items.every((item) => item.imageUrl));
  for (const item of catalog.items) {
    if (item.imageUrl) { assert.match(item.imageUrl, /^\/img\/super-tacos\/approved\//); assert.ok(existsSync(`public${item.imageUrl}`)); }
  }
  assert.equal(catalog.restaurant.logo_url, "/img/super-tacos/approved/supertacologo.svg");
  assert.ok(existsSync(`public${catalog.restaurant.logo_url}`));
  const portraits = JSON.parse(readFileSync("public/img/super-tacos/approved/avatars/provenance.json", "utf8"));
  assert.equal(portraits.images.length, 5);
  assert.match(portraits.usage, /did not provide/);
  assert.match(superTacosContent.reviews.disclosure, /People pictured did not provide/);
  assert.ok(existsSync("public/fonts/titan-one/TitanOne-Regular.ttf"));
  assert.match(readFileSync("public/fonts/titan-one/OFL.txt", "utf8"), /SIL OPEN FONT LICENSE/);
  const old = JSON.parse(readFileSync("public/img/super-tacos/sources.json", "utf8"));
  assert.ok(old.every((source: { status: string }) => source.status.includes("Retired")));
  assert.doesNotMatch(readFileSync("scripts/download-super-tacos-photos.mjs", "utf8"), /https?:\/\//);
});

test("prepared content sync changes only tenant catalog data and relies on existing server validation", () => {
  const sql = readFileSync("supabase/seeds/staging/016_super_tacos_content_c1.sql", "utf8");
  for (const guard of ["jjvongzvtnzlvwdfcnjk", "aws-0-us-east-2.pooler.supabase.com", "pg_stat_ssl", "sync-super-tacos-sprint-c3", "content_backup", "order_status not in", "Reserved ID collision", "other_before is distinct from other_after", "Required modifier postcondition"]) assert.ok(sql.includes(guard));
  assert.ok(sql.includes("menu_man.content_client_tls"));
  assert.ok(sql.includes("verify-full"));
  assert.match(sql, /current_setting\('menu_man\.content_host'\)='db\.jjvongzvtnzlvwdfcnjk\.supabase\.co'[\s\S]*exists\(select 1 from pg_stat_ssl where pid=pg_backend_pid\(\) and ssl\)/);
  assert.match(sql, /current_setting\('menu_man\.content_host'\)='aws-0-us-east-2\.pooler\.supabase\.com'[\s\S]*current_setting\('menu_man\.content_user'\)='postgres\.jjvongzvtnzlvwdfcnjk'/);
  assert.doesNotMatch(sql, /\b(?:create|alter|drop)\s+(?:table|function|policy|trigger|schema)\b/i);
  assert.doesNotMatch(sql, /(?:delete from|update|insert into) public\.(?:orders|order_items|order_item_modifiers|payment\w*|restaurant_payment\w*|restaurant_ordering\w*|menu_item_hearts)/i);
  assert.doesNotMatch(sql, /delete from public\.menu_items/i);
  const checkout = readFileSync("supabase/migrations/202609110001_fix_checkout_request_fingerprint_ambiguity.sql", "utf8");
  assert.match(checkout, /selected_count < group_record.min_selections/);
  assert.match(checkout, /selected_count > group_record.max_selections/);
  assert.match(checkout, /MM_INVALID_MODIFIERS/);
  const wrapper = readFileSync("scripts/sync-super-tacos-content.ps1", "utf8");
  assert.ok(wrapper.indexOf("if (!$Execute)") < wrapper.indexOf("Get-Command psql"));
  assert.match(wrapper, /verify-full/);
  assert.match(wrapper, /-c '\\conninfo'/);
  assert.match(wrapper, /SSL connection/);
  assert.match(wrapper, /protocol:\\s\*TLS/);
  assert.match(wrapper, /ConnectionPort -ne 5432/);
  assert.match(wrapper, /PGSSLROOTCERT/);
  assert.match(wrapper, /postgresql\/root\.crt/);
  assert.match(wrapper, /aws-0-us-east-2\.pooler\.supabase\.com/);
  assert.match(wrapper, /menu_man_client_tls_mode=verify-full/);
  assert.match(wrapper, /ExpectedSqlSha256/);
});

test("read-only content verifier uses PL/pgSQL locals distinct from database columns", () => {
  const verifier = readFileSync("supabase/qa/super-tacos-content-verify.sql", "utf8");
  const block = verifier.match(/do \$verify\$([\s\S]*?)\$verify\$;/)?.[1];
  assert.ok(block, "generated verifier block is present");
  assert.match(block, /v_item_id uuid; v_section_id uuid; v_group_id uuid;/);
  assert.match(block, /p\.item_id=v_item_id and p\.section_id=v_section_id/);
  assert.doesNotMatch(block, /\b(?:item_id|section_id|group_id)\s+uuid\b/);
  assert.doesNotMatch(block, /p\.item_id=item_id|p\.section_id=section_id/);
  assert.match(verifier, /menu_man_payment_fingerprint/);
  assert.match(verifier, /menu_man_ordering_fingerprint/);
  assert.match(block, /Payment or ordering configuration fingerprint changed/);
  assert.match(block, /v_option_id uuid/);
  assert.match(block, /Modifier option content mismatch/);
});
