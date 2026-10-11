"use client";

import { calculateLineTotalCents, calculateUnitPriceCents, formatPrice } from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import MenuCardImage from "./MenuCardImage";
import MenuIcon from "./MenuIcon";
import QuantityControl from "./QuantityControl";
import styles from "./menu-browser.module.css";

type Props = {
  line: CartLine;
  currency: string;
  imageUrl: string | null;
  mobile: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
};

export default function CartLineRow({ line, currency, imageUrl, mobile, onEdit, onRemove, onQuantityChange }: Props) {
  return <article className={styles.cartLine}>
    <div className={styles.cartRowSurface}>
      <div className={styles.cartThumbnail}><MenuCardImage name={line.itemName} url={imageUrl} priority={false} /></div>
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
            <button type="button" aria-label={`Edit ${line.itemName}`} title={`Edit ${line.itemName}`} onClick={onEdit}>{mobile ? <MenuIcon name="edit" size={19} /> : "Edit"}</button>
            <button type="button" aria-label={`Remove ${line.itemName}`} title={`Remove ${line.itemName}`} onClick={onRemove}>{mobile ? <MenuIcon name="trash" size={19} /> : "Remove"}</button>
          </div>
        </div>
      </div>
    </div>
  </article>;
}
