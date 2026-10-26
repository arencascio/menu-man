import { isMenuModifierOptionAvailable, resolveModifierPriceCents } from "@/lib/cart/cart";
import type { MenuModifierGroup } from "@/lib/cart/types";
import { assertModifierConditions } from "@/lib/cart/conditional-modifiers";

export type MenuModifierGroupRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type MenuModifierOptionRow = {
  id: string;
  modifier_group_id: string;
  name: string;
  default_price_adjustment_cents: number;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
};

export type MenuModifierAttachmentRow = {
  parent_modifier_group_id?: string | null;
  parent_modifier_option_id?: string | null;
  menu_item_id: string;
  modifier_group_id: string;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  is_active: boolean;
};

export type MenuModifierOverrideRow = {
  menu_item_id: string;
  modifier_group_id: string;
  modifier_option_id: string;
  price_adjustment_cents: number | null;
  sort_order: number | null;
  is_active: boolean;
};

export type ModifierQueryError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

export type ModifierQueryResult<T> = {
  data: readonly T[] | null;
  error: ModifierQueryError | null;
};

export type MenuModifierQueryResults = {
  groups: ModifierQueryResult<MenuModifierGroupRow>;
  options: ModifierQueryResult<MenuModifierOptionRow>;
  attachments: ModifierQueryResult<MenuModifierAttachmentRow>;
  overrides: ModifierQueryResult<MenuModifierOverrideRow>;
};

export const MODIFIER_QUERY_PAGE_SIZE = 1000;

export class MenuModifierLoadError extends Error {
  constructor(readonly failedQueries: string[], message = "Menu modifier data could not be loaded safely.") {
    super(message);
    this.name = "MenuModifierLoadError";
  }
}

export async function loadPaginatedModifierQuery<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: readonly T[] | null;
    error: ModifierQueryError | null;
  }>,
  pageSize = MODIFIER_QUERY_PAGE_SIZE,
): Promise<ModifierQueryResult<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    let result: { data: readonly T[] | null; error: ModifierQueryError | null };
    try {
      result = await fetchPage(from, from + pageSize - 1);
    } catch (error) {
      return {
        data: null,
        error: {
          code: "QUERY_REJECTED",
          message: error instanceof Error ? error.message : "Modifier query rejected without an Error instance.",
        },
      };
    }
    if (result.error) return { data: null, error: result.error };
    if (result.data === null) {
      return {
        data: null,
        error: { code: "MISSING_DATA", message: "Query page returned neither data nor an error." },
      };
    }
    rows.push(...result.data);
    if (result.data.length < pageSize) return { data: rows, error: null };
  }
}

export function summarizeModifierQueryFailures(results: MenuModifierQueryResults) {
  return (Object.entries(results) as Array<[keyof MenuModifierQueryResults, ModifierQueryResult<unknown>]>)
    .flatMap(([query, result]) => {
      if (result.error) return [{ query, error: result.error }];
      if (result.data === null) {
        return [{ query, error: { code: "MISSING_DATA", message: "Query returned neither data nor an error." } }];
      }
      return [];
    });
}

export function createMenuModifierGroupResolverFromQueries(results: MenuModifierQueryResults) {
  const failures = summarizeModifierQueryFailures(results);
  if (failures.length > 0) {
    throw new MenuModifierLoadError(failures.map(({ query }) => query));
  }

  return createMenuModifierGroupResolver(
    results.groups.data!,
    results.options.data!,
    results.attachments.data!,
    results.overrides.data!,
  );
}

export function createMenuModifierGroupResolver(
  groups: readonly MenuModifierGroupRow[],
  options: readonly MenuModifierOptionRow[],
  attachments: readonly MenuModifierAttachmentRow[],
  overrides: readonly MenuModifierOverrideRow[],
): (menuItemId: string) => MenuModifierGroup[] {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const optionsByGroupId = new Map<string, MenuModifierOptionRow[]>();
  for (const option of options) {
    const groupOptions = optionsByGroupId.get(option.modifier_group_id) || [];
    groupOptions.push(option);
    optionsByGroupId.set(option.modifier_group_id, groupOptions);
  }

  const overridesByItemAndOption = new Map(
    overrides.map((override) => [
      `${override.menu_item_id}:${override.modifier_option_id}`,
      override,
    ]),
  );
  const attachmentsByItemId = new Map<string, MenuModifierAttachmentRow[]>();
  for (const attachment of attachments) {
    const itemAttachments = attachmentsByItemId.get(attachment.menu_item_id) || [];
    itemAttachments.push(attachment);
    attachmentsByItemId.set(attachment.menu_item_id, itemAttachments);
  }

  return (menuItemId) => {
    const itemAttachments = attachmentsByItemId.get(menuItemId) || [];
    for (const attachment of itemAttachments) {
      if (!attachment.is_active || !attachment.parent_modifier_group_id) continue;
      const parent = itemAttachments.find((candidate) => candidate.modifier_group_id === attachment.parent_modifier_group_id);
      if (!parent || parent.parent_modifier_group_id || parent === attachment
        || !(optionsByGroupId.get(parent.modifier_group_id) || []).some((option) => option.id === attachment.parent_modifier_option_id)) {
        throw new MenuModifierLoadError([], "A conditional modifier relationship is invalid.");
      }
    }
    const resolved = (attachmentsByItemId.get(menuItemId) || [])
      .flatMap((attachment) => {
        const group = groupsById.get(attachment.modifier_group_id);
        if (!group) {
          throw new MenuModifierLoadError([], "An active menu item modifier attachment references a missing group.");
        }
        if (!group.is_active || !attachment.is_active) return [];
        if (Boolean(attachment.parent_modifier_group_id) !== Boolean(attachment.parent_modifier_option_id)) {
          throw new MenuModifierLoadError([], "A conditional modifier relationship is incomplete.");
        }

        const effectiveOptions = (optionsByGroupId.get(group.id) || [])
          .flatMap((option) => {
            const override = overridesByItemAndOption.get(`${menuItemId}:${option.id}`);
            if (!isMenuModifierOptionAvailable(
              group.is_active,
              option.is_active,
              attachment.is_active,
              override?.is_active,
            )) return [];

            return [{
              id: option.id,
              name: option.name,
              priceAdjustmentCents: resolveModifierPriceCents(
                override?.price_adjustment_cents,
                option.default_price_adjustment_cents,
              ),
              sortOrder: override?.sort_order ?? option.sort_order,
              isDefault: option.is_default,
            }];
          })
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

        if (attachment.min_selections > effectiveOptions.length) {
          throw new MenuModifierLoadError([], "A required menu modifier group has no valid active option path.");
        }

        return [{
          id: group.id,
          ...(attachment.parent_modifier_group_id && attachment.parent_modifier_option_id
            ? { visibleWhen: { groupId: attachment.parent_modifier_group_id, optionId: attachment.parent_modifier_option_id } } : {}),
          name: group.name,
          description: group.description,
          minSelections: attachment.min_selections,
          maxSelections: attachment.max_selections,
          sortOrder: attachment.sort_order,
          options: effectiveOptions,
        }];
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    // Disabled parent paths hide their children, without disabling unrelated root choices.
    const available = resolved.filter((group) => {
      const condition = group.visibleWhen;
      return !condition || resolved.some((parent) => parent.id === condition.groupId
        && parent.options.some((option) => option.id === condition.optionId));
    });
    try { assertModifierConditions(available); }
    catch { throw new MenuModifierLoadError([], "A conditional modifier has no available root option on this item."); }
    return available;
  };
}
