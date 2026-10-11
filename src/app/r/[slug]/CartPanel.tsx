"use client";

import { useLayoutEffect, useId, useRef, useSyncExternalStore, type RefObject } from "react";
import { formatPrice } from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import CartLineRow from "./CartLineRow";
import MenuIcon from "./MenuIcon";
import { containOverlayFocus } from "./overlay-focus";
import useExitAnimation from "./useExitAnimation";
import { lockMenuPageScroll } from "./menu-surface-scroll";
import styles from "./menu-browser.module.css";

const mobileQuery = "(max-width: 760px)";
function subscribeMobile(callback: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const readMobile = () => window.matchMedia(mobileQuery).matches;
const readServerMobile = () => false;

type CartPanelProps = {
  lines: CartLine[];
  currency: string;
  subtotalCents: number;
  imageUrls: ReadonlyMap<string, string | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onEdit: (line: CartLine) => void;
  onRemove: (lineId: string) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onClear: () => void;
  onCheckout: () => void;
};

export default function CartPanel({
  lines,
  currency,
  subtotalCents,
  imageUrls,
  triggerRef,
  onClose,
  onEdit,
  onRemove,
  onQuantityChange,
  onClear,
  onCheckout,
}: CartPanelProps) {
  const mobile = useSyncExternalStore(subscribeMobile, readMobile, readServerMobile);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmationRef = useRef<HTMLDialogElement>(null);
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationLockRef = useRef<(() => void) | null>(null);
  const confirmationId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { closing, requestClose } = useExitAnimation(dialogRef, onClose);
  const closeCart = requestClose;

  useLayoutEffect(() => () => confirmationLockRef.current?.(), []);

  function closeConfirmation() {
    confirmationLockRef.current?.();
    confirmationLockRef.current = null;
    const target = clearButtonRef.current?.isConnected ? clearButtonRef.current : closeButtonRef.current;
    target?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = triggerRef.current;
    const unlock = lockMenuPageScroll();
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-cart-close]")?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      unlock();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [triggerRef]);

  const panel = (
    <aside className={styles.cartPanel} aria-label="Your cart">
      <div className={styles.cartHeader}>
        <h2>Cart</h2>
        <button ref={closeButtonRef} data-cart-close className={styles.closeButton} type="button" aria-label="Close cart" title="Close cart" onClick={closeCart}>{mobile ? <MenuIcon name="close" size={22} /> : "Close"}</button>
      </div>

      {lines.length === 0 ? (
        <div className={styles.cartEmpty}><MenuIcon name="sad" size={72} /><p>Your cart is empty</p></div>
      ) : (
        <>
          <div className={styles.cartLines}>
            {lines.map((line) => <CartLineRow
              key={line.lineId}
              line={line}
              currency={currency}
              imageUrl={imageUrls.get(line.menuItemId) ?? null}
              mobile={mobile}
              onEdit={() => onEdit(line)}
              onRemove={() => {
                dialogRef.current?.querySelector<HTMLButtonElement>("[data-cart-close]")?.focus({ preventScroll: true });
                onRemove(line.lineId);
              }}
              onQuantityChange={(quantity) => onQuantityChange(line.lineId, quantity)}
            />)}
          </div>
          <div className={styles.cartFooter}>
            <button ref={clearButtonRef} className={styles.clearCartButton} type="button" onClick={() => {
              if (confirmationRef.current?.open || closing) return;
              confirmationLockRef.current = lockMenuPageScroll();
              confirmationRef.current?.showModal();
              confirmationRef.current?.querySelector<HTMLButtonElement>("[data-clear-cancel]")?.focus({ preventScroll: true });
            }}>Clear cart</button>
            <p><span>Subtotal</span><strong>{formatPrice(subtotalCents, currency)}</strong></p>
            <small>Displayed prices will be verified by the restaurant before checkout.</small>
            <button className={styles.checkoutButton} type="button" onClick={onCheckout}>Continue to Checkout</button>
          </div>
        </>
      )}
      <dialog ref={confirmationRef} className={styles.cartConfirmation} aria-labelledby={`${confirmationId}-title`} aria-describedby={`${confirmationId}-body`} onCancel={(event) => event.stopPropagation()} onClose={closeConfirmation} onKeyDown={containOverlayFocus}>
        <h2 id={`${confirmationId}-title`}>Clear your cart?</h2>
        <p id={`${confirmationId}-body`}>This will remove all items from your cart.</p>
        <div className={styles.confirmationActions}>
          <button data-clear-cancel className={styles.closeButton} type="button" onClick={() => confirmationRef.current?.close()}>Cancel</button>
          <button className={styles.checkoutButton} type="button" onClick={() => { confirmationRef.current?.close(); onClear(); }}>Yes, clear cart</button>
        </div>
      </dialog>
    </aside>
  );

  return <dialog ref={dialogRef} className={styles.cartSheet} data-closing={closing} aria-label="Cart" onCancel={(event) => {
    event.preventDefault();
    requestClose();
  }} onKeyDown={containOverlayFocus}>{panel}</dialog>;
}
