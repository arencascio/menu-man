"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics/client";
import { calculateLineTotalCents, formatPrice } from "@/lib/cart/cart";
import {
  checkoutRequestSchema,
  checkoutResponseSchema,
  idempotencyKeySchema,
  type PickupAvailability,
  type TipChoice,
} from "@/lib/checkout/contracts";
import {
  isPickupSelectionAvailable,
  resolvePickupSelection,
} from "@/lib/checkout/pickup-selection";
import {
  broadcastCheckoutEvent,
  fingerprintCart,
  saveActiveOrderMarker,
} from "@/lib/payments/browser-session";
import useRestaurantCart from "./useRestaurantCart";
import styles from "./menu-browser.module.css";

type CheckoutPanelProps = {
  restaurantId: string;
  restaurantSlug: string;
  menuId: string;
  currency: string;
};

type IdempotencyAttempt = { fingerprint: string; key: string };

const tipChoices: Array<{ value: TipChoice; label: string }> = [
  { value: "none", label: "No tip" },
  { value: "10_percent", label: "10%" },
  { value: "15_percent", label: "15%" },
  { value: "20_percent", label: "20%" },
];

async function fingerprintPayload(payload: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function CheckoutPanel({
  restaurantId,
  restaurantSlug,
  menuId,
  currency,
}: CheckoutPanelProps) {
  const router = useRouter();
  const cart = useRestaurantCart(restaurantId, currency);
  const [availability, setAvailability] = useState<PickupAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [pickupMode, setPickupMode] = useState<"asap" | "scheduled">("asap");
  const [pickupAt, setPickupAt] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [tipChoice, setTipChoice] = useState<TipChoice>("none");
  const [orderNotes, setOrderNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const attempt = useRef<IdempotencyAttempt | null>(null);
  const attemptStorageKey = `menu-man:checkout-attempt:v1:${restaurantId}`;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/restaurants/${encodeURIComponent(restaurantSlug)}/pickup-availability`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Pickup availability could not be loaded.");
      const nextAvailability = await response.json() as PickupAvailability;
      setAvailability(nextAvailability);
      const nextSelection = resolvePickupSelection(nextAvailability);
      if (nextSelection) {
        setPickupMode(nextSelection.mode);
        setPickupAt(nextSelection.mode === "scheduled" ? nextSelection.pickupAt : "");
      }
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setAvailabilityError(error instanceof Error ? error.message : "Pickup availability could not be loaded.");
      }
    });
    return () => controller.abort();
  }, [restaurantSlug]);

  const canPickup = isPickupSelectionAvailable(
    availability,
    pickupMode === "asap" ? { mode: "asap" } : { mode: "scheduled", pickupAt },
  );

  async function submitCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    const submittedLines = [...cart.lines];
    const parsedRequest = checkoutRequestSchema.safeParse({
      menuId,
      items: submittedLines.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        modifierOptionIds: line.selectedModifiers.map((modifier) => modifier.modifierOptionId),
        specialInstructions: line.specialInstructions,
      })),
      customer: { name: customerName, phone, email },
      pickup: pickupMode === "asap" ? { mode: "asap" } : { mode: "scheduled", pickupAt },
      tipChoice,
      orderNotes,
    });
    if (!parsedRequest.success) {
      setSubmitError(parsedRequest.error.issues[0]?.message || "Check the checkout form and try again.");
      return;
    }

    setSubmitting(true);
    try {
      const canonicalPayload = JSON.stringify(parsedRequest.data);
      const requestFingerprint = await fingerprintPayload(canonicalPayload);
      if (!attempt.current || attempt.current.fingerprint !== requestFingerprint) {
        let storedAttempt: IdempotencyAttempt | null = null;
        try {
          const storedValue = window.sessionStorage.getItem(attemptStorageKey);
          if (storedValue) {
            const candidate = JSON.parse(storedValue) as Partial<IdempotencyAttempt>;
            if (candidate.fingerprint === requestFingerprint && idempotencyKeySchema.safeParse(candidate.key).success) {
              storedAttempt = candidate as IdempotencyAttempt;
            }
          }
        } catch {
          // In-memory idempotency still protects this page load.
        }
        attempt.current = storedAttempt || { fingerprint: requestFingerprint, key: crypto.randomUUID() };
        try {
          window.sessionStorage.setItem(attemptStorageKey, JSON.stringify(attempt.current));
        } catch {
          // Storage is optional; the in-memory key remains stable.
        }
      }

      const cartFingerprint = await fingerprintCart(submittedLines);
      const response = await fetch(`/api/restaurants/${encodeURIComponent(restaurantSlug)}/orders`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.current.key },
        body: canonicalPayload,
      });
      const body = await response.json() as unknown;
      if (!response.ok) {
        const errorBody = body as { error?: { message?: string } };
        throw new Error(errorBody.error?.message || "Checkout could not be completed.");
      }
      const order = checkoutResponseSchema.parse(body);
      if (!order.paymentSession) throw new Error("No payment provider is configured for this restaurant.");
      window.sessionStorage.removeItem(attemptStorageKey);
      attempt.current = null;
      saveActiveOrderMarker(window.localStorage, {
        version: 1,
        restaurantId,
        restaurantSlug,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        cartFingerprint,
      });
      broadcastCheckoutEvent(restaurantId, "order_created");
      trackEvent({
        name: "order_created",
        restaurantId,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        currency: order.currency,
        valueCents: order.totalCents,
        taxCents: order.taxCents,
        tipCents: order.tipCents,
        pickupMode: order.pickup.mode,
        replayed: order.replayed,
        items: order.items.map((item) => ({
          itemId: item.menuItemId,
          itemName: item.itemName,
          priceCents: item.unitPriceCents,
          quantity: item.quantity,
        })),
      });
      router.replace(`/r/${encodeURIComponent(restaurantSlug)}/order/${encodeURIComponent(order.orderId)}/payment`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Checkout could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page} aria-label="Checkout details">
      <section className={styles.checkoutPanel}>
        <div className={styles.cartHeader}>
          <div><p className={styles.expandedLabel}>Checkout</p><h1>Review your order</h1></div>
          <Link className={styles.closeButton} href={`/r/${restaurantSlug}`}>Back to Menu</Link>
        </div>

        <div className={styles.checkoutReview}>
          {cart.lines.map((line) => (
            <div className={styles.checkoutReviewLine} key={line.lineId}>
              <span>{line.itemName}</span>
              <span className={styles.checkoutQuantityActions}>
                <button type="button" disabled={submitting} onClick={() => cart.setLineQuantity(line.lineId, line.quantity - 1)} aria-label={`Decrease ${line.itemName}`}>−</button>
                {line.quantity}
                <button type="button" disabled={submitting} onClick={() => cart.setLineQuantity(line.lineId, line.quantity + 1)} aria-label={`Increase ${line.itemName}`}>+</button>
                <button type="button" disabled={submitting} onClick={() => cart.removeLine(line.lineId)}>Remove</button>
              </span>
              <strong>{formatPrice(calculateLineTotalCents(line), currency)}</strong>
            </div>
          ))}
          <div><span>Estimated subtotal</span><strong>{formatPrice(cart.subtotalCents, currency)}</strong></div>
          <small>The server will verify all prices and calculate tax, tip, and the final total.</small>
        </div>

        <form className={styles.checkoutForm} onSubmit={submitCheckout}>
          <div className={styles.checkoutFields}>
            <label>Name<input required maxLength={200} autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
            <label>Phone<input required maxLength={50} autoComplete="tel" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label>Email <small>Optional</small><input maxLength={320} autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          </div>
          <fieldset className={styles.checkoutFieldset}>
            <legend>Pickup</legend>
            {availabilityError && <p className={styles.formError}>{availabilityError}</p>}
            {!availability && !availabilityError && <p>Loading current availability…</p>}
            {availability?.asap.enabled && <label><input type="radio" name="pickup-mode" checked={pickupMode === "asap"} disabled={!availability.asap.available} onChange={() => setPickupMode("asap")} /> ASAP</label>}
            {availability?.scheduled.enabled && availability.scheduled.slots.length > 0 && (
              <label><input type="radio" name="pickup-mode" checked={pickupMode === "scheduled"} onChange={() => setPickupMode("scheduled")} /> Scheduled
                <select value={pickupAt} onChange={(event) => setPickupAt(event.target.value)} disabled={pickupMode !== "scheduled"}>
                  {availability.scheduled.slots.map((slot) => <option key={slot.pickupAt} value={slot.pickupAt}>{slot.label}</option>)}
                </select>
              </label>
            )}
            {availability && !availability.asap.available && availability.scheduled.slots.length === 0 && <p className={styles.formError}>No pickup times are currently available.</p>}
            {availability?.timezone && <small>Times shown in {availability.timezone}.</small>}
          </fieldset>
          <fieldset className={styles.checkoutFieldset}>
            <legend>Tip</legend>
            <div className={styles.tipChoices}>{tipChoices.map((choice) => <label key={choice.value}><input type="radio" name="tip" checked={tipChoice === choice.value} onChange={() => setTipChoice(choice.value)} />{choice.label}</label>)}</div>
          </fieldset>
          <label className={styles.orderNotes}>Order notes <small>Optional</small><textarea maxLength={1000} rows={3} value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} /></label>
          {submitError && <p className={styles.formError} role="alert">{submitError}</p>}
          <small className={styles.checkoutActionHint}>You&apos;ll enter payment details next. You won&apos;t be charged yet.</small>
          <button className={styles.checkoutButton} type="submit" disabled={submitting || !canPickup || cart.lines.length === 0 || !cart.hydrated}>
            {submitting ? "Continuing to Payment…" : "Continue to Payment"}
          </button>
        </form>
      </section>
    </main>
  );
}
