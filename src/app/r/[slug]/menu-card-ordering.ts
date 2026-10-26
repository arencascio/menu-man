import { createModifierSelections, getCartLineSignature, getDefaultModifierOptionIds, getModifierValidationErrors } from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import { activeModifierOptionIds } from "@/lib/cart/conditional-modifiers";
import type { MenuItem, MenuSection } from "./MenuBrowser";
import { canCustomizeMenuItem } from "@/lib/restaurant-showcases";

// Read the committed cart configuration, rather than treating dispatch as success.
export function getConfiguredCartQuantity(lines: readonly CartLine[], signature: string) {
  return lines.reduce((total, line) => total + (getCartLineSignature(line) === signature ? line.quantity : 0), 0);
}

export function canAddMenuItemDirectly(item: MenuItem, cartPreview = false) {
  if (!canCustomizeMenuItem(item.is_orderable, cartPreview) || item.modifierGroups.some((group) => group.minSelections > 0)) return false;
  return getModifierValidationErrors(item.modifierGroups, getDefaultModifierOptionIds(item.modifierGroups)).size === 0;
}

export type MenuItemDraft = {
  selectedOptionIds: Set<string>;
  quantity: number;
  specialInstructions: string;
};

export function createMenuItemDraft(item: MenuItem, line?: CartLine | null): MenuItemDraft {
  return {
    selectedOptionIds: line
      ? activeModifierOptionIds(item.modifierGroups, new Set(line.selectedModifiers.map((modifier) => modifier.modifierOptionId)))
      : getDefaultModifierOptionIds(item.modifierGroups),
    quantity: line?.quantity ?? 1,
    specialInstructions: line?.specialInstructions ?? "",
  };
}

export function getCardAddMode(item: MenuItem, cartPreview = false): "direct" | "quick" | "full" {
  if (item.modifierGroups.some((group) => group.visibleWhen)) return "full";
  if (canAddMenuItemDirectly(item, cartPreview)) return "direct";
  const required = item.modifierGroups.filter((group) => group.minSelections > 0);
  const optionCount = required.reduce((count, group) => count + group.options.length, 0);
  if (canCustomizeMenuItem(item.is_orderable, cartPreview) && required.length >= 1 && required.length <= 2 && optionCount <= 8
    && required.every((group) => group.minSelections === 1 && group.maxSelections === 1 && group.options.length >= 1 && group.options.length <= 6)) {
    return "quick";
  }
  return "full";
}

export function hasOptionalCustomization(item: MenuItem) {
  return item.modifierGroups.some((group) => group.minSelections === 0 && group.options.length > 0);
}

export function createMenuCartLine(item: MenuItem, section: Pick<MenuSection, "id" | "name">, lineId: string, draft: MenuItemDraft): CartLine {
  return {
    lineId,
    menuItemId: item.id,
    sectionId: section.id,
    sectionName: section.name,
    itemName: item.name,
    quantity: draft.quantity,
    basePriceCents: item.price_cents,
    selectedModifiers: createModifierSelections(item.modifierGroups, draft.selectedOptionIds),
    specialInstructions: draft.specialInstructions.trim(),
  };
}

export function createDirectCartLine(item: MenuItem, section: MenuSection, lineId: string): CartLine {
  return createMenuCartLine(item, section, lineId, createMenuItemDraft(item));
}
