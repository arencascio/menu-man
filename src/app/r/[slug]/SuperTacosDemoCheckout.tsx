"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { calculateLineTotalCents, formatPrice } from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import { SUPER_TACOS_ID, SUPER_TACOS_SLUG } from "@/lib/demo/policy";
import useRestaurantCart from "./useRestaurantCart";
import styles from "./super-tacos-demo-checkout.module.css";

const receiptStorageKey = `menu-man:demo-receipt:v1:${SUPER_TACOS_ID}`;
type DemoReceipt = { number: string; createdAt: string; lines: CartLine[]; subtotalCents: number };

function subscribeReceipt(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("demo-receipt-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("demo-receipt-change", callback);
  };
}

function readReceiptSnapshot() {
  try { return window.localStorage.getItem(receiptStorageKey); }
  catch { return null; }
}

function parseReceipt(snapshot: string | null): DemoReceipt | null {
  try {
    const value: unknown = JSON.parse(snapshot || "null");
    if (!value || typeof value !== "object") return null;
    const receipt = value as DemoReceipt;
    if (typeof receipt.number !== "string" || !Array.isArray(receipt.lines) || !Number.isInteger(receipt.subtotalCents)) return null;
    return receipt;
  } catch { return null; }
}

export default function SuperTacosDemoCheckout() {
  const cart = useRestaurantCart(SUPER_TACOS_ID, "USD");
  const receiptSnapshot = useSyncExternalStore(subscribeReceipt, readReceiptSnapshot, () => null);
  const receipt = parseReceipt(receiptSnapshot);
  const [step, setStep] = useState<"review" | "payment">("review");

  function startAnotherOrder() {
    try { window.localStorage.removeItem(receiptStorageKey); } catch { /* Current visit remains usable. */ }
    window.dispatchEvent(new Event("demo-receipt-change"));
    setStep("review");
  }

  function simulatePayment() {
    if (!cart.hydrated || cart.lines.length === 0) return;
    const order: DemoReceipt = {
      number: `ST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      lines: cart.lines,
      subtotalCents: cart.subtotalCents,
    };
    try { window.localStorage.setItem(receiptStorageKey, JSON.stringify(order)); } catch { /* Keep receipt in memory if storage is unavailable. */ }
    window.dispatchEvent(new Event("demo-receipt-change"));
    cart.clearAfterOrderCreated();
  }

  if (!cart.hydrated) return <main className={styles.page} aria-busy="true"><p className={styles.loading}>Preparing your sample order…</p></main>;

  if (receipt) return <main className={styles.page}>
    <section className={styles.receipt} aria-labelledby="demo-receipt-title">
      <div className={styles.receiptMark} aria-hidden="true">✓</div>
      <p className={styles.eyebrow}>Super Tacos · Order preview</p>
      <h1 id="demo-receipt-title">That’s a delicious-looking order.</h1>
      <p className={styles.lede}>Your sample receipt is ready. This order exists only in this browser.</p>
      <div className={styles.receiptNotice}><strong>No payment was taken.</strong><span>No order was sent to a restaurant, and nothing will be prepared.</span></div>
      <div className={styles.receiptMeta}><span>Sample order</span><strong>#{receipt.number}</strong></div>
      <ul className={styles.receiptLines}>{receipt.lines.map((line) => <li key={line.lineId}><span><b>{line.quantity} × {line.itemName}</b>{line.selectedModifiers.length > 0 && <small>{line.selectedModifiers.map((item) => item.modifierOptionName).join(" · ")}</small>}</span><strong>{formatPrice(calculateLineTotalCents(line), "USD")}</strong></li>)}</ul>
      <div className={styles.total}><span>Estimated total</span><strong>{formatPrice(receipt.subtotalCents, "USD")}</strong></div>
      <p className={styles.estimate}>Illustrative estimate only · no tax or charge collected</p>
      <Link className={styles.primaryButton} href={`/r/${SUPER_TACOS_SLUG}/menu`} onClick={startAnotherOrder}>Start another sample order</Link>
      <Link className={styles.textLink} href={`/r/${SUPER_TACOS_SLUG}/menu`}>Back to the menu</Link>
    </section>
  </main>;

  if (cart.lines.length === 0) return <main className={styles.page}>
    <section className={styles.empty} aria-labelledby="empty-title"><p className={styles.eyebrow}>Super Tacos · Sample checkout</p><h1 id="empty-title">Your sample cart is empty.</h1><p>Choose a few favorites from the menu to see how a complete order could feel.</p><Link className={styles.primaryButton} href={`/r/${SUPER_TACOS_SLUG}/menu`}>Browse the menu</Link></section>
  </main>;

  return <main className={styles.page}>
    <div className={styles.checkout}>
      <section className={styles.order} aria-labelledby="sample-order-title">
        <Link className={styles.textLink} href={`/r/${SUPER_TACOS_SLUG}/menu`}>← Back to menu</Link>
        <p className={styles.eyebrow}>Super Tacos · Sample checkout</p>
        <h1 id="sample-order-title">{step === "review" ? "Your order, your way." : "A simple, simulated payment."}</h1>
        <p className={styles.lede}>{step === "review" ? "Review your picks, then see the final step of a sample checkout." : "This visual preview uses no card details and contacts no payment service."}</p>
        {step === "review" ? <div className={styles.lines}>{cart.lines.map((line) => <article className={styles.line} key={line.lineId}>
          <div><h2>{line.quantity} × {line.itemName}</h2><p>{line.sectionName}</p>{line.selectedModifiers.length > 0 && <ul>{line.selectedModifiers.map((modifier) => <li key={modifier.modifierOptionId}>{modifier.modifierOptionName}{modifier.priceAdjustmentCents > 0 ? ` (+${formatPrice(modifier.priceAdjustmentCents, "USD")})` : ""}</li>)}</ul>}{line.specialInstructions && <p className={styles.note}>“{line.specialInstructions}”</p>}</div>
          <strong>{formatPrice(calculateLineTotalCents(line), "USD")}</strong>
          <div className={styles.quantity}><button type="button" aria-label={`Decrease ${line.itemName} quantity`} onClick={() => line.quantity === 1 ? cart.removeLine(line.lineId) : cart.setLineQuantity(line.lineId, line.quantity - 1)}>−</button><span>{line.quantity}</span><button type="button" aria-label={`Increase ${line.itemName} quantity`} onClick={() => cart.setLineQuantity(line.lineId, line.quantity + 1)}>+</button><button type="button" className={styles.remove} onClick={() => cart.removeLine(line.lineId)}>Remove</button></div>
        </article>)}</div> : <div className={styles.paymentCard}>
          <div className={styles.cardTop}><span>DEMO PAYMENT</span><span aria-hidden="true">✦</span></div><div className={styles.chip} aria-hidden="true"><i /><i /><i /><i /></div><p className={styles.cardNumber}>•••• &nbsp; •••• &nbsp; •••• &nbsp; 0000</p><div className={styles.cardBottom}><span>NO CARD DETAILS</span><span>PREVIEW ONLY</span></div>
          <p className={styles.cardDisclosure}>This card artwork is an illustration. No number, name, or security code is requested or stored.</p>
        </div>}
      </section>
      <aside className={styles.summary} aria-label="Estimated order total">
        <p className={styles.eyebrow}>Order summary</p><div className={styles.summaryRow}><span>{cart.totalQuantity} items</span><strong>{formatPrice(cart.subtotalCents, "USD")}</strong></div><div className={styles.summaryRow}><span>Tax and fees</span><span>Not calculated</span></div><div className={styles.summaryTotal}><span>Estimated amount</span><strong>{formatPrice(cart.subtotalCents, "USD")}</strong></div><p className={styles.estimate}>Estimate only. No actual charge will occur.</p>
        {step === "review" ? <button className={styles.primaryButton} type="button" onClick={() => setStep("payment")}>Continue to demo payment</button> : <><button className={styles.primaryButton} type="button" onClick={simulatePayment}>Simulate payment</button><button className={styles.secondaryButton} type="button" onClick={() => setStep("review")}>Back to order</button></>}
        <p className={styles.safeNote}>Browser-only demonstration · no restaurant order or payment is created.</p>
      </aside>
    </div>
  </main>;
}
