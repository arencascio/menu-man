import { createModifierSelections, getDefaultModifierOptionIds, getModifierValidationErrors } from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import type { MenuItem, MenuSection } from "./MenuBrowser";

export function canAddMenuItemDirectly(item: MenuItem) {
  if (!item.is_orderable || item.modifierGroups.some((group) => group.minSelections > 0)) return false;
  return getModifierValidationErrors(item.modifierGroups, getDefaultModifierOptionIds(item.modifierGroups)).size === 0;
}

export function createDirectCartLine(item: MenuItem, section: MenuSection, lineId: string): CartLine {
  return {
    lineId,
    menuItemId: item.id,
    sectionId: section.id,
    sectionName: section.name,
    itemName: item.name,
    quantity: 1,
    basePriceCents: item.price_cents,
    selectedModifiers: createModifierSelections(item.modifierGroups, getDefaultModifierOptionIds(item.modifierGroups)),
    specialInstructions: "",
  };
}
