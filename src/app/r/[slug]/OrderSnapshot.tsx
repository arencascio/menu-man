import { formatPrice } from "@/lib/cart/cart";
import type { OrderPaymentView } from "@/lib/payments/view-contracts";
import styles from "./menu-browser.module.css";

export default function OrderSnapshot({ order }: { order: OrderPaymentView["order"] }) {
  return (
    <>
      <p className={styles.confirmationTotal}>{formatPrice(order.totalCents, order.currency)}</p>
      <div className={styles.checkoutReview}>
        {order.items.map((item) => (
          <div className={styles.orderSnapshotLine} key={item.orderItemId}>
            <span>
              <strong>{item.quantity} × {item.itemName}</strong>
              {item.modifiers.map((modifier) => (
                <small key={`${modifier.groupName}:${modifier.optionName}`}>{modifier.groupName}: {modifier.optionName}</small>
              ))}
              {item.specialInstructions && <small>{item.specialInstructions}</small>}
            </span>
            <strong>{formatPrice(item.lineTotalCents, order.currency)}</strong>
          </div>
        ))}
      </div>
      <dl className={styles.authoritativeTotals}>
        <div><dt>Subtotal</dt><dd>{formatPrice(order.subtotalCents, order.currency)}</dd></div>
        <div><dt>Tax</dt><dd>{formatPrice(order.taxCents, order.currency)}</dd></div>
        <div><dt>Tip</dt><dd>{formatPrice(order.tipCents, order.currency)}</dd></div>
        <div><dt>Total</dt><dd>{formatPrice(order.totalCents, order.currency)}</dd></div>
      </dl>
    </>
  );
}
