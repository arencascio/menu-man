import {
  calculateLineTotalCents,
  calculateUnitPriceCents,
  formatPrice,
} from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import QuantityControl from "./QuantityControl";
import styles from "./menu-browser.module.css";

type CartPanelProps = {
  lines: CartLine[];
  currency: string;
  subtotalCents: number;
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
  onClose,
  onEdit,
  onRemove,
  onQuantityChange,
  onClear,
  onCheckout,
}: CartPanelProps) {
  return (
    <aside className={styles.cartPanel} aria-label="Your cart">
      <div className={styles.cartHeader}>
        <div>
          <p className={styles.expandedLabel}>Your order</p>
          <h2>Cart</h2>
        </div>
        <button className={styles.closeButton} type="button" onClick={onClose}>Close</button>
      </div>

      {lines.length === 0 ? (
        <p className={styles.cartEmpty}>Your cart is empty.</p>
      ) : (
        <>
          <div className={styles.cartLines}>
            {lines.map((line) => (
              <article className={styles.cartLine} key={line.lineId}>
                <div className={styles.cartLineHeading}>
                  <div>
                    <h3>{line.itemName}</h3>
                    <p>{formatPrice(calculateUnitPriceCents(line), currency)} each</p>
                  </div>
                  <strong>{formatPrice(calculateLineTotalCents(line), currency)}</strong>
                </div>
                {line.selectedModifiers.length > 0 && (
                  <ul>
                    {line.selectedModifiers.map((modifier) => (
                      <li key={modifier.modifierOptionId}>
                        {modifier.modifierOptionName}
                        {modifier.priceAdjustmentCents > 0 ? ` (+${formatPrice(modifier.priceAdjustmentCents, currency)})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {line.specialInstructions && <p className={styles.cartInstructions}>{line.specialInstructions}</p>}
                <div className={styles.cartLineActions}>
                  <QuantityControl compact quantity={line.quantity} onChange={(quantity) => onQuantityChange(line.lineId, quantity)} />
                  <button type="button" onClick={() => onEdit(line)}>Edit</button>
                  <button type="button" onClick={() => onRemove(line.lineId)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.cartFooter}>
            <button className={styles.clearCartButton} type="button" onClick={onClear}>Clear cart</button>
            <p><span>Subtotal</span><strong>{formatPrice(subtotalCents, currency)}</strong></p>
            <small>Displayed prices will be verified by the restaurant before checkout.</small>
            <button className={styles.checkoutButton} type="button" onClick={onCheckout}>Continue to Checkout</button>
          </div>
        </>
      )}
    </aside>
  );
}
