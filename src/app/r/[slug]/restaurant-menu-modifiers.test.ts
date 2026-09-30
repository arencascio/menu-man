import assert from "node:assert/strict";
import test from "node:test";
import {
  createMenuModifierGroupResolver,
  createMenuModifierGroupResolverFromQueries,
  loadPaginatedModifierQuery,
  MODIFIER_QUERY_PAGE_SIZE,
  MenuModifierLoadError,
  summarizeModifierQueryFailures,
} from "./restaurant-menu-modifiers";

const removeIngredients = {
  id: "armando-remove-ingredients",
  name: "Remove ingredients",
  description: "Select included ingredients to leave out.",
  is_active: true,
};

const optionDefinitions = [
  ["guacamole", "No Guacamole"],
  ["pico", "No Pico de Gallo"],
  ["cheese", "No Cheese"],
  ["sour-cream", "No Sour Cream"],
  ["beans", "No Beans"],
  ["rice", "No Rice"],
  ["onion", "No Onion"],
  ["cilantro", "No Cilantro"],
  ["fries", "No Fries"],
  ["cabbage", "No Cabbage"],
  ["lettuce", "No Lettuce"],
  ["potatoes", "No Homestyle Potatoes"],
  ["bell-peppers", "No Bell Peppers"],
  ["avocado", "No Avocado"],
] as const;

const groupOptions = optionDefinitions.map(([sourceOptionId, name], index) => ({
  id: `remove-option-${sourceOptionId}`,
  modifier_group_id: removeIngredients.id,
  name,
  default_price_adjustment_cents: 0,
  sort_order: index,
  is_default: false,
  is_active: true,
}));

function activeOverrides(menuItemId: string, activeOptionIds: readonly string[]) {
  const active = new Set(activeOptionIds);
  return groupOptions.map((option) => ({
    menu_item_id: menuItemId,
    modifier_group_id: removeIngredients.id,
    modifier_option_id: option.id,
    price_adjustment_cents: null,
    sort_order: null,
    is_active: active.has(option.id),
  }));
}

test("menu route modifier transformation restricts Cabeza Taco and batch-1 control to exact options", () => {
  const cabezaId = "018e2221-b533-477f-8193-b3c5c95de6b5";
  const baconSausageId = "batch-1-bacon-sausage-burrito";
  const optionsBySourceId = new Map(
    optionDefinitions.map(([sourceId]) => [sourceId, `remove-option-${sourceId}`]),
  );
  const resolveGroups = createMenuModifierGroupResolver(
    [removeIngredients],
    groupOptions,
    [cabezaId, baconSausageId].map((menu_item_id) => ({
      menu_item_id,
      modifier_group_id: removeIngredients.id,
      min_selections: 0,
      max_selections: 14,
      sort_order: 0,
      is_active: true,
    })),
    [
      ...activeOverrides(cabezaId, (["onion", "cilantro"] as const).map((id) => optionsBySourceId.get(id)!)),
      ...activeOverrides(baconSausageId, (["cheese", "potatoes"] as const).map((id) => optionsBySourceId.get(id)!)),
    ],
  );

  assert.equal(groupOptions.length, 14);

  assert.deepEqual(
    resolveGroups(cabezaId).flatMap((group) => group.options.map((option) => option.name)),
    ["No Onion", "No Cilantro"],
  );
  assert.deepEqual(
    resolveGroups(baconSausageId).flatMap((group) => group.options.map((option) => option.name)),
    ["No Cheese", "No Homestyle Potatoes"],
  );
});

test("a failed override query is surfaced and cannot produce an unrestricted item payload", () => {
  const cabezaId = "018e2221-b533-477f-8193-b3c5c95de6b5";
  const queryResults = {
    groups: { data: [removeIngredients], error: null },
    options: { data: groupOptions, error: null },
    attachments: {
      data: [{
        menu_item_id: cabezaId,
        modifier_group_id: removeIngredients.id,
        min_selections: 0,
        max_selections: 14,
        sort_order: 0,
        is_active: true,
      }],
      error: null,
    },
    overrides: {
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the menu_item_modifier_option_overrides relation.",
        details: "The table was not found in the schema cache.",
        hint: "Reload the schema cache.",
      },
    },
  };

  assert.deepEqual(
    summarizeModifierQueryFailures(queryResults).map(({ query }) => query),
    ["overrides"],
  );

  let menuItemPayload: ReturnType<ReturnType<typeof createMenuModifierGroupResolver>> | undefined;
  assert.throws(() => {
    const resolveGroups = createMenuModifierGroupResolverFromQueries(queryResults);
    menuItemPayload = resolveGroups(cabezaId);
  }, (error: unknown) => error instanceof MenuModifierLoadError
    && error.failedQueries.includes("overrides"));
  assert.equal(menuItemPayload, undefined);
});

test("successful empty modifier queries remain distinct from failed queries", () => {
  const emptyResults = {
    groups: { data: [], error: null },
    options: { data: [], error: null },
    attachments: { data: [], error: null },
    overrides: { data: [], error: null },
  };

  assert.deepEqual(summarizeModifierQueryFailures(emptyResults), []);
  assert.deepEqual(createMenuModifierGroupResolverFromQueries(emptyResults)("item"), []);
});

test("modifier pagination requests an empty final page when the result is exactly 1,000 rows", async () => {
  const rows = Array.from({ length: MODIFIER_QUERY_PAGE_SIZE }, (_, id) => ({ id }));
  const requestedRanges: Array<[number, number]> = [];
  const result = await loadPaginatedModifierQuery(async (from, to) => {
    requestedRanges.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  });

  assert.deepEqual(requestedRanges, [[0, 999], [1000, 1999]]);
  assert.equal(result.data?.length, MODIFIER_QUERY_PAGE_SIZE);
  assert.equal(result.error, null);
});

test("modifier pagination loads multiple pages, a short final page, and no duplicate rows", async () => {
  const rows = Array.from({ length: 2405 }, (_, id) => ({ id }));
  const requestedRanges: Array<[number, number]> = [];
  const result = await loadPaginatedModifierQuery(async (from, to) => {
    requestedRanges.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  });

  assert.deepEqual(requestedRanges, [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.deepEqual(result.data, rows);
  assert.equal(new Set(result.data?.map((row) => row.id)).size, rows.length);
});

test("Cabeza-style overrides after row 1,000 resolve only after the later page is loaded", async () => {
  const cabezaId = "018e2221-b533-477f-8193-b3c5c95de6b5";
  const allowedOptionIds = ["remove-option-onion", "remove-option-cilantro"];
  const fillerRows = Array.from({ length: MODIFIER_QUERY_PAGE_SIZE }, (_, index) => ({
    menu_item_id: `earlier-item-${index}`,
    modifier_group_id: removeIngredients.id,
    modifier_option_id: groupOptions[index % groupOptions.length].id,
    price_adjustment_cents: null,
    sort_order: null,
    is_active: true,
  }));
  const databaseRows = [...fillerRows, ...activeOverrides(cabezaId, allowedOptionIds)];
  const requestedRanges: Array<[number, number]> = [];
  const overrides = await loadPaginatedModifierQuery(async (from, to) => {
    requestedRanges.push([from, to]);
    return { data: databaseRows.slice(from, to + 1), error: null };
  });

  assert.deepEqual(requestedRanges, [[0, 999], [1000, 1999]]);
  assert.equal(overrides.data?.length, 1014);

  const resolveGroups = createMenuModifierGroupResolverFromQueries({
    groups: { data: [removeIngredients], error: null },
    options: { data: groupOptions, error: null },
    attachments: {
      data: [{
        menu_item_id: cabezaId,
        modifier_group_id: removeIngredients.id,
        min_selections: 0,
        max_selections: 14,
        sort_order: 0,
        is_active: true,
      }],
      error: null,
    },
    overrides,
  });

  assert.deepEqual(
    resolveGroups(cabezaId).flatMap((group) => group.options.map((option) => option.name)),
    ["No Onion", "No Cilantro"],
  );
});

test("a later modifier page failure discards partial rows and fails closed", async () => {
  const requestedRanges: Array<[number, number]> = [];
  const result = await loadPaginatedModifierQuery(async (from, to) => {
    requestedRanges.push([from, to]);
    if (from > 0) {
      return {
        data: null,
        error: { code: "PGRST000", message: "Later page unavailable." },
      };
    }
    return {
      data: Array.from({ length: MODIFIER_QUERY_PAGE_SIZE }, (_, id) => ({ id })),
      error: null,
    };
  });

  assert.deepEqual(requestedRanges, [[0, 999], [1000, 1999]]);
  assert.equal(result.data, null);
  assert.equal(result.error?.message, "Later page unavailable.");
  assert.throws(() => createMenuModifierGroupResolverFromQueries({
    groups: { data: [removeIngredients], error: null },
    options: { data: groupOptions, error: null },
    attachments: { data: [], error: null },
    overrides: { data: null, error: result.error },
  }), (error: unknown) => error instanceof MenuModifierLoadError
    && error.failedQueries.includes("overrides"));
});

test("a rejected later modifier page is surfaced and does not return first-page rows", async () => {
  const result = await loadPaginatedModifierQuery(async (from) => {
    if (from > 0) throw new Error("Network connection dropped.");
    return {
      data: Array.from({ length: MODIFIER_QUERY_PAGE_SIZE }, (_, id) => ({ id })),
      error: null,
    };
  });

  assert.equal(result.data, null);
  assert.equal(result.error?.code, "QUERY_REJECTED");
  assert.match(result.error?.message ?? "", /Network connection dropped/);
  assert.throws(() => createMenuModifierGroupResolverFromQueries({
    groups: { data: [removeIngredients], error: null },
    options: { data: groupOptions, error: null },
    attachments: { data: [], error: null },
    overrides: { data: null, error: result.error },
  }), (error: unknown) => error instanceof MenuModifierLoadError
    && error.failedQueries.includes("overrides"));
});
