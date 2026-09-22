"use client";

import { useMemo, useState } from "react";
import {
  calculateUnitPriceCents,
  createModifierSelections,
  formatPrice,
  getDefaultModifierOptionIds,
  getModifierValidationErrors,
  MAX_SPECIAL_INSTRUCTIONS_LENGTH,
} from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import type { MenuItem } from "./MenuBrowser";
import ModifierGroupFieldset from "./ModifierGroupFieldset";
import QuantityControl from "./QuantityControl";
import styles from "./menu-browser.module.css";

type OrderItemPanelProps = {
  item: MenuItem;
  sectionId: string;
  sectionName: string;
  currency: string;
  editingLine: CartLine | null;
  onSave: (line: CartLine) => void;
  liked: boolean;
  heartCount: number;
  heartPending: boolean;
  onHeart: () => void;
};

export default function OrderItemPanel({
  item,
  sectionId,
  sectionName,
  currency,
  editingLine,
  onSave,
  liked,
  heartCount,
  heartPending,
  onHeart,
}: OrderItemPanelProps) {
  const [selectedOptionIds, setSelectedOptionIds] = useState(() => (
    editingLine
      ? new Set(editingLine.selectedModifiers.map((modifier) => modifier.modifierOptionId))
      : getDefaultModifierOptionIds(item.modifierGroups)
  ));
  const [quantity, setQuantity] = useState(editingLine?.quantity || 1);
  const [specialInstructions, setSpecialInstructions] = useState(editingLine?.specialInstructions || "");

  const validationErrors = useMemo(
    () => getModifierValidationErrors(item.modifierGroups, selectedOptionIds),
    [item.modifierGroups, selectedOptionIds],
  );
  const selectedModifiers = useMemo(
    () => createModifierSelections(item.modifierGroups, selectedOptionIds),
    [item.modifierGroups, selectedOptionIds],
  );
  const unitPriceCents = calculateUnitPriceCents({
    basePriceCents: item.price_cents,
    selectedModifiers,
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item.is_orderable || validationErrors.size > 0) return;

    onSave({
      lineId: editingLine?.lineId || crypto.randomUUID(),
      menuItemId: item.id,
      sectionId,
      sectionName,
      itemName: item.name,
      quantity,
      basePriceCents: item.price_cents,
      selectedModifiers,
      specialInstructions: specialInstructions.trim(),
    });
  }

  return (
    <article className={styles.expandedItem} aria-label={`Order ${item.name}`}>
      <div className={styles.expandedMedia}>
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.name} />
        ) : (
          <span className={styles.expandedPlaceholder}>{item.name.charAt(0)}</span>
        )}
      </div>
      <form className={styles.orderForm} onSubmit={submit}>
        <div className={styles.orderFormHeader}>
          <div>
            <p className={styles.expandedLabel}>{item.is_orderable ? "Build your order" : "Menu item"}</p>
            <h3>{item.name}</h3>
            <p className={styles.itemPanelPrice}>{formatPrice(item.price_cents, currency)}</p>
          </div>
          <div className={styles.detailActions}>
            <button className={styles.detailHeartButton} type="button" aria-pressed={liked} aria-label={`${liked ? "Unlike" : "Like"} ${item.name}`} disabled={heartPending} onClick={onHeart}>
              <span aria-hidden="true">{liked ? "♥" : "♡"}</span>{heartCount > 0 ? ` ${heartCount}` : ""}
            </button>
          </div>
        </div>
        {item.description && <p className={styles.expandedDescription}>{item.description}</p>}
        {item.is_orderable ? (
          <>
            {item.modifierGroups.map((group) => (
              <ModifierGroupFieldset
                key={group.id}
                group={group}
                currency={currency}
                selectedOptionIds={selectedOptionIds}
                onChange={setSelectedOptionIds}
              />
            ))}
            <div className={styles.orderFields}>
              <label>
                <span>Quantity</span>
                <QuantityControl quantity={quantity} onChange={setQuantity} />
              </label>
              <label>
                <span>Special instructions <small>Optional</small></span>
                <textarea
                  value={specialInstructions}
                  maxLength={MAX_SPECIAL_INSTRUCTIONS_LENGTH}
                  rows={3}
                  onChange={(event) => setSpecialInstructions(event.target.value)}
                  placeholder="Preparation requests only; do not include contact or payment information."
                />
                <small>{specialInstructions.length}/{MAX_SPECIAL_INSTRUCTIONS_LENGTH}</small>
              </label>
            </div>
            {validationErrors.size > 0 && (
              <p className={styles.formHint}>Complete the required selections to add this item.</p>
            )}
            <button
              className={styles.addToCartButton}
              type="submit"
              disabled={validationErrors.size > 0}
            >
              {editingLine ? "Update Cart" : "Add to Cart"} · {formatPrice(unitPriceCents * quantity, currency)}
            </button>
          </>
        ) : (
          <p className={styles.notOrderable}>Online ordering is not available for this item yet.</p>
        )}
      </form>
    </article>
  );
}
