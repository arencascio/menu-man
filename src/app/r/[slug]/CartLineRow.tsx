"use client";

import { useRef, type PointerEvent } from "react";
import { calculateLineTotalCents, calculateUnitPriceCents, formatPrice } from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import { CART_SWIPE_DISTANCE, getCartSwipeAction, getCartSwipeAxis, type CartSwipeAction, type CartSwipeAxis } from "./cart-swipe";
import MenuCardImage from "./MenuCardImage";
import MenuIcon from "./MenuIcon";
import QuantityControl from "./QuantityControl";
import styles from "./menu-browser.module.css";

type Props = {
  line: CartLine;
  currency: string;
  imageUrl: string | null;
  mobile: boolean;
  revealed: CartSwipeAction | null;
  onReveal: (action: CartSwipeAction | null) => void;
  onEdit: () => void;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
};

export default function CartLineRow({ line, currency, imageUrl, mobile, revealed, onReveal, onEdit, onRemove, onQuantityChange }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; base: number; offset: number; axis: CartSwipeAxis } | null>(null);

  function finishSwipe(event: PointerEvent<HTMLElement>, cancelled = false) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.removeAttribute("data-dragging");
    surface.current?.style.removeProperty("transform");
    if (gesture.axis === "horizontal") onReveal(cancelled ? null : getCartSwipeAction(gesture.offset));
  }

  return <article
    className={styles.cartLine}
    data-revealed={mobile ? revealed : undefined}
    onPointerDown={(event) => {
      if (!mobile || !event.isPrimary || event.pointerType === "mouse" || (event.target as HTMLElement).closest("button, input, a")) return;
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, base: revealed === "edit" ? CART_SWIPE_DISTANCE : revealed === "remove" ? -CART_SWIPE_DISTANCE : 0, offset: 0, axis: "pending" };
    }}
    onPointerMove={(event) => {
      const gesture = drag.current;
      if (!gesture || gesture.id !== event.pointerId || gesture.axis === "vertical") return;
      const x = event.clientX - gesture.x, y = event.clientY - gesture.y;
      if (gesture.axis === "pending") {
        gesture.axis = getCartSwipeAxis(x, y);
        if (gesture.axis !== "horizontal") return;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.setAttribute("data-dragging", "true");
      }
      gesture.offset = Math.max(-CART_SWIPE_DISTANCE, Math.min(CART_SWIPE_DISTANCE, gesture.base + x));
      if (event.cancelable) event.preventDefault();
      if (surface.current) surface.current.style.transform = `translateX(${gesture.offset}px)`;
    }}
    onPointerUp={finishSwipe}
    onPointerCancel={(event) => finishSwipe(event, true)}
    onLostPointerCapture={(event) => {
      // Ignore the bubbled loss of implicit touch capture when it moves from
      // a child to this row; only losing the row's own capture cancels it.
      if (event.target === event.currentTarget) finishSwipe(event, true);
    }}
  >
    {mobile && <>
      <button data-cart-swipe-action className={`${styles.cartSwipeAction} ${styles.cartSwipeEdit}`} type="button" aria-label={`Edit ${line.itemName}`} title={`Edit ${line.itemName}`} disabled={revealed !== "edit"} aria-hidden={revealed !== "edit"} tabIndex={revealed === "edit" ? 0 : -1} onClick={() => {
        // The revealed action disappears while editing; return to the stable
        // row control when the item dialog closes.
        editButton.current?.focus({ preventScroll: true });
        onEdit();
      }}><MenuIcon name="edit" size={22} /></button>
      <button data-cart-swipe-action className={`${styles.cartSwipeAction} ${styles.cartSwipeRemove}`} type="button" aria-label={`Remove ${line.itemName}`} title={`Remove ${line.itemName}`} disabled={revealed !== "remove"} aria-hidden={revealed !== "remove"} tabIndex={revealed === "remove" ? 0 : -1} onClick={onRemove}><MenuIcon name="trash" size={22} /></button>
    </>}
    <div ref={surface} className={styles.cartRowSurface}>
      {mobile && <div className={styles.cartThumbnail}><MenuCardImage name={line.itemName} url={imageUrl} priority={false} /></div>}
      <div className={styles.cartRowContent}>
        <div className={styles.cartLineHeading}>
          <div className={styles.cartLineIdentity}><h3>{line.itemName}</h3></div>
          <strong>{formatPrice(calculateLineTotalCents(line), currency)}</strong>
        </div>
        {line.selectedModifiers.length > 0 && <ul className={styles.cartModifiers}>
          {line.selectedModifiers.map((modifier) => <li key={modifier.modifierOptionId}>
            {modifier.modifierOptionName}{modifier.priceAdjustmentCents > 0 ? ` (+${formatPrice(modifier.priceAdjustmentCents, currency)})` : ""}
          </li>)}
        </ul>}
        {line.specialInstructions && <p className={styles.cartInstructions}>{line.specialInstructions}</p>}
        <div className={styles.cartLinePurchase}>
          <div className={styles.cartLineQuantity}>
            <QuantityControl compact quantity={line.quantity} onChange={onQuantityChange} />
            <p>{formatPrice(calculateUnitPriceCents(line), currency)} each</p>
          </div>
          <div className={styles.cartLineActions}>
            <button ref={editButton} type="button" aria-label={`Edit ${line.itemName}`} title={`Edit ${line.itemName}`} onClick={onEdit}>{mobile ? <MenuIcon name="edit" size={19} /> : "Edit"}</button>
            <button type="button" aria-label={`Remove ${line.itemName}`} title={`Remove ${line.itemName}`} onClick={onRemove}>{mobile ? <MenuIcon name="trash" size={19} /> : "Remove"}</button>
          </div>
        </div>
      </div>
    </div>
  </article>;
}
