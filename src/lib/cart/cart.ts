import type {
  CartAction,
  CartLine,
  CartModifierSelection,
  CartState,
  MenuModifierGroup,
} from "./types";

export const MAX_CART_QUANTITY = 99;
export const MAX_SPECIAL_INSTRUCTIONS_LENGTH = 500;

export function resolveModifierPriceCents(
  itemOverrideCents: number | null | undefined,
  optionDefaultCents: number | null | undefined,
) {
  return itemOverrideCents ?? optionDefaultCents ?? 0;
}

export function isMenuModifierOptionAvailable(
  groupIsActive: boolean,
  optionIsActive: boolean,
  attachmentIsActive: boolean,
  overrideIsActive: boolean | null | undefined,
) {
  return groupIsActive
    && optionIsActive
    && attachmentIsActive
    && overrideIsActive !== false;
}

export function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(priceCents / 100);
}

export function clampQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_CART_QUANTITY, Math.max(1, Math.trunc(quantity)));
}

export function calculateUnitPriceCents(line: Pick<CartLine, "basePriceCents" | "selectedModifiers">) {
  return line.basePriceCents + line.selectedModifiers.reduce(
    (total, modifier) => total + modifier.priceAdjustmentCents,
    0,
  );
}

export function calculateLineTotalCents(line: CartLine) {
  return calculateUnitPriceCents(line) * line.quantity;
}

export function calculateCartSubtotalCents(lines: readonly CartLine[]) {
  return lines.reduce((total, line) => total + calculateLineTotalCents(line), 0);
}

export function getModifierValidationErrors(
  groups: readonly MenuModifierGroup[],
  selectedOptionIds: ReadonlySet<string>,
) {
  const errors = new Map<string, string>();

  for (const group of groups) {
    const selectedCount = group.options.filter((option) => selectedOptionIds.has(option.id)).length;
    if (group.minSelections === group.maxSelections && selectedCount !== group.minSelections) {
      errors.set(group.id, `Select exactly ${group.minSelections}.`);
    } else if (selectedCount < group.minSelections) {
      errors.set(
        group.id,
        `Select at least ${group.minSelections}.`,
      );
    } else if (selectedCount > group.maxSelections) {
      errors.set(group.id, `Select no more than ${group.maxSelections}.`);
    }
  }

  return errors;
}

export function getDefaultModifierOptionIds(groups: readonly MenuModifierGroup[]) {
  const selectedOptionIds = new Set<string>();

  for (const group of groups) {
    const defaults = group.options.filter((option) => option.isDefault);
    const defaultsAreValid = defaults.length >= group.minSelections
      && defaults.length <= group.maxSelections;

    if (!defaultsAreValid) continue;
    for (const option of defaults) selectedOptionIds.add(option.id);
  }

  return selectedOptionIds;
}

export function shouldShowMaxSelectionGuidance(group: MenuModifierGroup) {
  const exactlyOne = group.minSelections === 1 && group.maxSelections === 1;
  return !exactlyOne && group.maxSelections < group.options.length;
}

export function createModifierSelections(
  groups: readonly MenuModifierGroup[],
  selectedOptionIds: ReadonlySet<string>,
): CartModifierSelection[] {
  return groups.flatMap((group) =>
    group.options
      .filter((option) => selectedOptionIds.has(option.id))
      .map((option) => ({
        modifierGroupId: group.id,
        modifierGroupName: group.name,
        modifierOptionId: option.id,
        modifierOptionName: option.name,
        priceAdjustmentCents: option.priceAdjustmentCents,
      })),
  );
}

export function createCartState(restaurantId: string, currency: string): CartState {
  return { restaurantId, currency, lines: [], hydrated: false };
}

export function getCartLineSignature(line: CartLine) {
  // Quantity, row IDs, menu-section placement, and display labels are not
  // customer configuration. Keep price snapshots as a conservative merge guard
  // so consolidation never reprices an existing line or changes its subtotal.
  const modifiers = line.selectedModifiers.map((selection) => [
    selection.modifierGroupId,
    selection.modifierOptionId,
    selection.priceAdjustmentCents,
  ]).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return JSON.stringify([
    line.menuItemId,
    modifiers,
    line.specialInstructions.trim(),
    line.basePriceCents,
  ]);
}

function consolidateCartLines(lines: readonly CartLine[]) {
  const consolidated: CartLine[] = [];
  const signatures = new Map<string, number[]>();
  for (const line of lines) {
    const signature = getCartLineSignature(line);
    const candidates = signatures.get(signature) ?? [];
    const index = candidates.find((candidate) => consolidated[candidate].quantity + line.quantity <= MAX_CART_QUANTITY);
    if (index !== undefined) {
      consolidated[index] = { ...consolidated[index], quantity: consolidated[index].quantity + line.quantity };
    } else {
      // Retain overflow rows from historical carts or edit collisions rather
      // than dropping ordered quantities or exceeding the per-line limit.
      signatures.set(signature, [...candidates, consolidated.length]);
      consolidated.push(line);
    }
  }
  return consolidated;
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  if (action.type === "hydrate") {
    // Existing active-order fingerprints include row IDs and quantities. Keep
    // hydration lossless; consolidate only when the customer mutates the cart.
    return {
      restaurantId: action.cart.restaurantId,
      currency: action.cart.currency,
      lines: action.cart.lines,
      hydrated: true,
    };
  }

  if (action.type === "add") {
    const signature = getCartLineSignature(action.line);
    const matching = state.lines.findIndex((line) => getCartLineSignature(line) === signature && line.quantity < MAX_CART_QUANTITY);
    const equivalentExists = state.lines.some((line) => getCartLineSignature(line) === signature);
    const lines = matching >= 0
      ? state.lines.map((line, index) => index === matching
        ? { ...line, quantity: clampQuantity(line.quantity + clampQuantity(action.line.quantity)) }
        : line)
      : equivalentExists ? state.lines : [...state.lines, { ...action.line, quantity: clampQuantity(action.line.quantity) }];
    return { ...state, lines: consolidateCartLines(lines) };
  }

  if (action.type === "replace") {
    if (!state.lines.some((line) => line.lineId === action.line.lineId)) return state;
    return {
      ...state,
      lines: consolidateCartLines(state.lines.map((line) => (line.lineId === action.line.lineId
        ? { ...action.line, quantity: clampQuantity(action.line.quantity) }
        : line))),
    };
  }

  if (action.type === "remove") {
    return { ...state, lines: state.lines.filter((line) => line.lineId !== action.lineId) };
  }

  if (action.type === "set_quantity") {
    return {
      ...state,
      lines: state.lines.map((line) =>
        line.lineId === action.lineId ? { ...line, quantity: clampQuantity(action.quantity) } : line,
      ),
    };
  }

  return { ...state, lines: [] };
}
