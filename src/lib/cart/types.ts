export type MenuModifierOption = {
  id: string;
  name: string;
  priceAdjustmentCents: number;
  sortOrder: number;
  isDefault: boolean;
};

export type MenuModifierGroup = {
  id: string;
  name: string;
  description: string | null;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: MenuModifierOption[];
};

export type CartModifierSelection = {
  modifierGroupId: string;
  modifierGroupName: string;
  modifierOptionId: string;
  modifierOptionName: string;
  priceAdjustmentCents: number;
};

export type CartLine = {
  lineId: string;
  menuItemId: string;
  sectionId: string;
  sectionName: string;
  itemName: string;
  quantity: number;
  basePriceCents: number;
  selectedModifiers: CartModifierSelection[];
  specialInstructions: string;
};

export type StoredCart = {
  version: 1;
  restaurantId: string;
  currency: string;
  lines: CartLine[];
  updatedAt: string;
};

export type CartState = {
  restaurantId: string;
  currency: string;
  lines: CartLine[];
  hydrated: boolean;
};

export type CartAction =
  | { type: "hydrate"; cart: StoredCart }
  | { type: "add"; line: CartLine }
  | { type: "replace"; line: CartLine }
  | { type: "remove"; lineId: string }
  | { type: "set_quantity"; lineId: string; quantity: number }
  | { type: "clear" };
