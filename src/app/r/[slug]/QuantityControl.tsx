import { MAX_CART_QUANTITY } from "@/lib/cart/cart";
import MenuIcon from "./MenuIcon";
import styles from "./menu-browser.module.css";

type QuantityControlProps = {
  quantity: number;
  onChange: (quantity: number) => void;
  compact?: boolean;
};

export default function QuantityControl({ quantity, onChange, compact = false }: QuantityControlProps) {
  return (
    <div className={compact ? `${styles.quantityControl} ${styles.quantityControlCompact}` : styles.quantityControl} aria-label="Quantity">
      <button type="button" onClick={() => onChange(Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label="Decrease quantity">
        <MenuIcon name="minus" size={16} />
      </button>
      <input
        aria-label="Quantity"
        inputMode="numeric"
        min="1"
        max={MAX_CART_QUANTITY}
        type="number"
        value={quantity}
        onChange={(event) => onChange(Math.min(MAX_CART_QUANTITY, Math.max(1, Number(event.target.value) || 1)))}
      />
      <button type="button" onClick={() => onChange(Math.min(MAX_CART_QUANTITY, quantity + 1))} disabled={quantity >= MAX_CART_QUANTITY} aria-label="Increase quantity">
        <MenuIcon name="plus" size={16} />
      </button>
    </div>
  );
}
