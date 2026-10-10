"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  calculateUnitPriceCents,
  createModifierSelections,
  formatPrice,
  getModifierValidationErrors,
  MAX_SPECIAL_INSTRUCTIONS_LENGTH,
} from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import type { MenuItem } from "./MenuBrowser";
import { createMenuCartLine, type MenuItemDraft } from "./menu-card-ordering";
import ModifierGroupFieldset from "./ModifierGroupFieldset";
import QuantityControl from "./QuantityControl";
import MenuFavoriteButton from "./MenuFavoriteButton";
import MenuIcon from "./MenuIcon";
import styles from "./menu-browser.module.css";

type OrderItemPanelProps = {
  item: MenuItem;
  sectionId: string;
  sectionName: string;
  currency: string;
  editingLine: CartLine | null;
  draft: MenuItemDraft;
  onDraftChange: (draft: MenuItemDraft) => void;
  inCartQuantity: number;
  onSave: (line: CartLine) => void;
  liked: boolean;
  heartCount: number;
  heartPending: boolean;
  onHeart: () => void;
  saving: boolean;
  saveFeedback: "sparkles" | "smile" | null;
  saveError: string;
  onSuccessComplete: () => void;
};

export default function OrderItemPanel({
  item,
  sectionId,
  sectionName,
  currency,
  editingLine,
  draft,
  onDraftChange,
  inCartQuantity,
  onSave,
  liked,
  heartCount,
  heartPending,
  onHeart,
  saving,
  saveFeedback,
  saveError,
  onSuccessComplete,
}: OrderItemPanelProps) {
  const submitRef = useRef<HTMLButtonElement>(null);
  const successCallback = useRef(onSuccessComplete);
  useLayoutEffect(() => { successCallback.current = onSuccessComplete; });
  useLayoutEffect(() => {
    if (!saveFeedback) return;
    let active = true;
    const animations = submitRef.current?.getAnimations() ?? [];
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (active) successCallback.current();
    });
    return () => { active = false; };
  }, [saveFeedback]);
  const validationErrors = useMemo(
    () => getModifierValidationErrors(item.modifierGroups, draft.selectedOptionIds),
    [item.modifierGroups, draft.selectedOptionIds],
  );
  const selectedModifiers = useMemo(
    () => createModifierSelections(item.modifierGroups, draft.selectedOptionIds),
    [item.modifierGroups, draft.selectedOptionIds],
  );
  const unitPriceCents = calculateUnitPriceCents({
    basePriceCents: item.price_cents,
    selectedModifiers,
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !item.is_orderable || validationErrors.size > 0) return;

    onSave(createMenuCartLine(item, { id: sectionId, name: sectionName }, editingLine?.lineId || crypto.randomUUID(), draft));
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
      <form className={styles.orderForm} onSubmit={submit} aria-busy={saving}>
        <div className={styles.orderFormHeader}>
          <div>
            <p className={styles.expandedLabel}>{item.is_orderable ? "Build your order" : "Menu item"}</p>
            <h3>{item.name}</h3>
            <p className={styles.itemPanelPrice}>{formatPrice(item.price_cents, currency)}</p>
            {inCartQuantity > 0 && <p className={styles.detailCartStatus}>{inCartQuantity} in cart</p>}
          </div>
          <div className={styles.detailActions}>
            <MenuFavoriteButton detail name={item.name} liked={liked} count={heartCount} pending={heartPending} onClick={onHeart} />
          </div>
        </div>
        {item.description && <p className={styles.expandedDescription}>{item.description}</p>}
        {item.is_orderable ? (
          <fieldset disabled={saving} className={styles.detailOrderFields}>
            {item.modifierGroups.map((group) => (
              <ModifierGroupFieldset
                key={group.id}
                group={group}
                currency={currency}
                selectedOptionIds={draft.selectedOptionIds}
                onChange={(selectedOptionIds) => onDraftChange({ ...draft, selectedOptionIds })}
              />
            ))}
            <div className={styles.orderFields}>
              <label>
                <span>Quantity</span>
                <QuantityControl quantity={draft.quantity} onChange={(quantity) => onDraftChange({ ...draft, quantity })} />
              </label>
              <label>
                <span>Special instructions <small>Optional</small></span>
                <textarea
                  value={draft.specialInstructions}
                  maxLength={MAX_SPECIAL_INSTRUCTIONS_LENGTH}
                  rows={3}
                  onChange={(event) => onDraftChange({ ...draft, specialInstructions: event.target.value })}
                  placeholder="Preparation requests only; do not include contact or payment information."
                />
                <small>{draft.specialInstructions.length}/{MAX_SPECIAL_INSTRUCTIONS_LENGTH}</small>
              </label>
            </div>
            {validationErrors.size > 0 && (
              <p className={styles.formHint}>Complete the required selections to add this item.</p>
            )}
            <button
              ref={submitRef}
              className={styles.addToCartButton}
              data-success={Boolean(saveFeedback)}
              type="submit"
              disabled={saving || validationErrors.size > 0}
            >
              {saveFeedback ? <span role="status" className={styles.detailSuccess}><MenuIcon name={saveFeedback} size={24} />Added to cart</span> : <>{editingLine ? "Update Cart" : "Add to Cart"} · {formatPrice(unitPriceCents * draft.quantity, currency)}</>}
            </button>
            {saveError && <p role="alert" className={styles.formError}>{saveError}</p>}
          </fieldset>
        ) : (
          <p className={styles.notOrderable}>Online ordering is not available for this item yet.</p>
        )}
      </form>
    </article>
  );
}
