import { createModifierSelections, getDefaultModifierOptionIds, getModifierValidationErrors } from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import type { MenuItem, MenuSection } from "./MenuBrowser";

export function canAddMenuItemDirectly(item: MenuItem) {
  if (!item.is_orderable || item.modifierGroups.some((group) => group.minSelections > 0)) return false;
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
      ? new Set(line.selectedModifiers.map((modifier) => modifier.modifierOptionId))
      : getDefaultModifierOptionIds(item.modifierGroups),
    quantity: line?.quantity ?? 1,
    specialInstructions: line?.specialInstructions ?? "",
  };
}

export function getCardAddMode(item: MenuItem): "direct" | "quick" | "full" {
  if (canAddMenuItemDirectly(item)) return "direct";
  const required = item.modifierGroups.filter((group) => group.minSelections > 0);
  const optionCount = required.reduce((count, group) => count + group.options.length, 0);
  if (item.is_orderable && required.length >= 1 && required.length <= 2 && optionCount <= 8
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
