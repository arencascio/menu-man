"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { formatPrice } from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import CartLineRow from "./CartLineRow";
import type { CartSwipeAction } from "./cart-swipe";
import MenuIcon from "./MenuIcon";
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
  const [revealed, setRevealed] = useState<{ lineId: string; action: CartSwipeAction } | null>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!mobile || !dialog) return;
    const opener = triggerRef.current;
    const unlock = lockMenuPageScroll();
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-cart-close]")?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      unlock();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [mobile, triggerRef]);

  const panel = (
    <aside className={styles.cartPanel} aria-label="Your cart" onPointerDownCapture={(event) => {
      if (!(event.target as HTMLElement).closest("[data-cart-swipe-action]")) setRevealed(null);
    }}>
      <div className={styles.cartHeader}>
        <h2>Cart</h2>
        <button data-cart-close className={styles.closeButton} type="button" aria-label="Close cart" title="Close cart" onClick={onClose}>{mobile ? <MenuIcon name="close" size={22} /> : "Close"}</button>
      </div>

      {lines.length === 0 ? (
        <p className={styles.cartEmpty}>Your cart is empty.</p>
      ) : (
        <>
          <div className={styles.cartLines}>
            {lines.map((line) => <CartLineRow
              key={line.lineId}
              line={line}
              currency={currency}
              imageUrl={imageUrls.get(line.menuItemId) ?? null}
              mobile={mobile}
              revealed={revealed?.lineId === line.lineId ? revealed.action : null}
              onReveal={(action) => setRevealed(action ? { lineId: line.lineId, action } : null)}
              onEdit={() => { setRevealed(null); onEdit(line); }}
              onRemove={() => {
                setRevealed(null);
                if (mobile) dialogRef.current?.querySelector<HTMLButtonElement>("[data-cart-close]")?.focus({ preventScroll: true });
                onRemove(line.lineId);
              }}
              onQuantityChange={(quantity) => onQuantityChange(line.lineId, quantity)}
            />)}
          </div>
          <div className={styles.cartFooter}>
            <button className={styles.clearCartButton} type="button" onClick={() => {
              if (mobile) dialogRef.current?.querySelector<HTMLButtonElement>("[data-cart-close]")?.focus({ preventScroll: true });
              onClear();
            }}>Clear cart</button>
            <p><span>Subtotal</span><strong>{formatPrice(subtotalCents, currency)}</strong></p>
            <small>Displayed prices will be verified by the restaurant before checkout.</small>
            <button className={styles.checkoutButton} type="button" onClick={onCheckout}>Continue to Checkout</button>
          </div>
        </>
      )}
    </aside>
  );

  if (!mobile) return panel;
  return <dialog ref={dialogRef} className={styles.cartSheet} aria-label="Cart" onCancel={(event) => {
    event.preventDefault();
    onClose();
  }} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), [tabindex='0']")].filter((element) => element.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>{panel}</dialog>;
}
