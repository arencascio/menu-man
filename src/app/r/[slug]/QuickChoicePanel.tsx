"use client";

import { calculateUnitPriceCents, createModifierSelections, formatPrice, getModifierValidationErrors } from "@/lib/cart/cart";
import type { MenuItem } from "./MenuBrowser";
import { hasOptionalCustomization, type MenuItemDraft } from "./menu-card-ordering";
import ModifierGroupFieldset from "./ModifierGroupFieldset";
import styles from "./menu-browser.module.css";

type QuickChoicePanelProps = {
  item: MenuItem;
  currency: string;
  draft: MenuItemDraft;
  inCartQuantity: number;
  onDraftChange: (draft: MenuItemDraft) => void;
  onAdd: () => void;
  onCustomize: () => void;
};

export default function QuickChoicePanel({ item, currency, draft, inCartQuantity, onDraftChange, onAdd, onCustomize }: QuickChoicePanelProps) {
  const requiredGroups = item.modifierGroups.filter((group) => group.minSelections > 0);
  const valid = getModifierValidationErrors(item.modifierGroups, draft.selectedOptionIds).size === 0;
  const unitPriceCents = calculateUnitPriceCents({
    basePriceCents: item.price_cents,
    selectedModifiers: createModifierSelections(item.modifierGroups, draft.selectedOptionIds),
  });

  return <div className={styles.quickChoicePanel}>
    <p className={styles.expandedLabel}>Quick add</p>
    <h3>{item.name}</h3>
    <p className={styles.itemPanelPrice}>{formatPrice(unitPriceCents, currency)}</p>
    {inCartQuantity > 0 && <p className={styles.detailCartStatus}>{inCartQuantity} in cart</p>}
    {requiredGroups.map((group) => <ModifierGroupFieldset
      key={group.id}
      group={group}
      currency={currency}
      selectedOptionIds={draft.selectedOptionIds}
      onChange={(selectedOptionIds) => onDraftChange({ ...draft, selectedOptionIds })}
    />)}
    {!valid && <p className={styles.formHint}>Complete the required selections to add this item.</p>}
    <button className={styles.addToCartButton} type="button" disabled={!valid} onClick={onAdd}>
      Add to Cart · {formatPrice(unitPriceCents * draft.quantity, currency)}
    </button>
    {hasOptionalCustomization(item) && <button className={styles.quickCustomize} type="button" onClick={onCustomize}>Customize…</button>}
  </div>;
}
