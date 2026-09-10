"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics/client";
import { calculateCartSubtotalCents, calculateLineTotalCents, formatPrice } from "@/lib/cart/cart";
import type { CartLine } from "@/lib/cart/types";
import {
  checkoutRequestSchema,
  checkoutResponseSchema,
  idempotencyKeySchema,
  type CheckoutResponse,
  type PickupAvailability,
  type TipChoice,
} from "@/lib/checkout/contracts";
import styles from "./menu-browser.module.css";

type CheckoutPanelProps = {
  restaurantId: string;
  restaurantSlug: string;
  menuId: string;
  currency: string;
  lines: CartLine[];
  onBack: () => void;
  onOrderConfirmed: () => void;
};

type IdempotencyAttempt = { fingerprint: string; key: string };

async function fingerprintPayload(payload: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const tipChoices: Array<{ value: TipChoice; label: string }> = [
  { value: "none", label: "No tip" },
  { value: "10_percent", label: "10%" },
  { value: "15_percent", label: "15%" },
  { value: "20_percent", label: "20%" },
];

export default function CheckoutPanel({
  restaurantId,
  restaurantSlug,
  menuId,
  currency,
  lines,
  onBack,
  onOrderConfirmed,
}: CheckoutPanelProps) {
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
  const [confirmation, setConfirmation] = useState<CheckoutResponse | null>(null);
  const attempt = useRef<IdempotencyAttempt | null>(null);
  const attemptStorageKey = `menu-man:checkout-attempt:v1:${restaurantId}`;

  useEffect(() => {
    const controller = new AbortController();
    async function loadAvailability() {
      try {
        const response = await fetch(
          `/api/restaurants/${encodeURIComponent(restaurantSlug)}/pickup-availability`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("Pickup availability could not be loaded.");
        const nextAvailability = await response.json() as PickupAvailability;
        setAvailability(nextAvailability);
        if (nextAvailability.asap.available) {
          setPickupMode("asap");
        } else if (nextAvailability.scheduled.slots.length > 0) {
          setPickupMode("scheduled");
          setPickupAt(nextAvailability.scheduled.slots[0].pickupAt);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setAvailabilityError(error instanceof Error ? error.message : "Pickup availability could not be loaded.");
        }
      }
    }
    void loadAvailability();
    return () => controller.abort();
  }, [restaurantSlug]);

  if (confirmation) {
    return (
      <section className={styles.checkoutPanel} aria-live="polite">
        <p className={styles.expandedLabel}>Order created</p>
        <h2>Order #{confirmation.orderNumber}</h2>
        <p className={styles.confirmationTotal}>{formatPrice(confirmation.totalCents, confirmation.currency)}</p>
        <p>
          This order is awaiting payment and has not been placed with the restaurant yet.
        </p>
        <dl className={styles.authoritativeTotals}>
          <div><dt>Subtotal</dt><dd>{formatPrice(confirmation.subtotalCents, confirmation.currency)}</dd></div>
          <div><dt>Tax</dt><dd>{formatPrice(confirmation.taxCents, confirmation.currency)}</dd></div>
          <div><dt>Tip</dt><dd>{formatPrice(confirmation.tipCents, confirmation.currency)}</dd></div>
          <div><dt>Total</dt><dd>{formatPrice(confirmation.totalCents, confirmation.currency)}</dd></div>
        </dl>
        <button className={styles.checkoutButton} type="button" onClick={onBack}>Return to Menu</button>
      </section>
    );
  }

  const canPickup = pickupMode === "asap"
    ? Boolean(availability?.asap.available)
    : Boolean(pickupAt && availability?.scheduled.slots.some((slot) => slot.pickupAt === pickupAt));

  async function submitCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const parsedRequest = checkoutRequestSchema.safeParse({
      menuId,
      items: lines.map((line) => ({
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
      const fingerprint = await fingerprintPayload(canonicalPayload);
      if (!attempt.current || attempt.current.fingerprint !== fingerprint) {
        let storedAttempt: IdempotencyAttempt | null = null;
        try {
          const storedValue = window.sessionStorage.getItem(attemptStorageKey);
          if (storedValue) {
            const candidate = JSON.parse(storedValue) as Partial<IdempotencyAttempt>;
            if (
              candidate.fingerprint === fingerprint
              && idempotencyKeySchema.safeParse(candidate.key).success
            ) {
              storedAttempt = candidate as IdempotencyAttempt;
            }
          }
        } catch {
          // Checkout still has in-memory idempotency when storage is unavailable.
        }

        attempt.current = storedAttempt || { fingerprint, key: crypto.randomUUID() };
        try {
          window.sessionStorage.setItem(attemptStorageKey, JSON.stringify(attempt.current));
        } catch {
          // Storage failure does not prevent a checkout attempt in this page load.
        }
      }

      const response = await fetch(`/api/restaurants/${encodeURIComponent(restaurantSlug)}/orders`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attempt.current.key,
        },
        body: canonicalPayload,
      });
      const body = await response.json() as unknown;
      if (!response.ok) {
        const errorBody = body as { error?: { message?: string } };
        throw new Error(errorBody.error?.message || "Checkout could not be completed.");
      }

      const order = checkoutResponseSchema.parse(body);
      try {
        window.sessionStorage.removeItem(attemptStorageKey);
      } catch {
        // A confirmed order must still complete if storage cleanup fails.
      }
      attempt.current = null;
      setConfirmation(order);
      onOrderConfirmed();
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
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Checkout could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.checkoutPanel} aria-label="Checkout">
      <div className={styles.cartHeader}>
        <div>
          <p className={styles.expandedLabel}>Checkout</p>
          <h2>Review your order</h2>
        </div>
        <button className={styles.closeButton} type="button" onClick={onBack}>Back to Cart</button>
      </div>

      <div className={styles.checkoutReview}>
        {lines.map((line) => (
          <div key={line.lineId}>
            <span>{line.quantity} × {line.itemName}</span>
            <strong>{formatPrice(calculateLineTotalCents(line), currency)}</strong>
          </div>
        ))}
        <div><span>Estimated subtotal</span><strong>{formatPrice(calculateCartSubtotalCents(lines), currency)}</strong></div>
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
          {availability?.asap.enabled && (
            <label><input type="radio" name="pickup-mode" checked={pickupMode === "asap"} disabled={!availability.asap.available} onChange={() => setPickupMode("asap")} /> ASAP</label>
          )}
          {availability?.scheduled.enabled && availability.scheduled.slots.length > 0 && (
            <label>
              <input type="radio" name="pickup-mode" checked={pickupMode === "scheduled"} onChange={() => setPickupMode("scheduled")} /> Scheduled
              <select value={pickupAt} onChange={(event) => setPickupAt(event.target.value)} disabled={pickupMode !== "scheduled"}>
                {availability.scheduled.slots.map((slot) => <option key={slot.pickupAt} value={slot.pickupAt}>{slot.label}</option>)}
              </select>
            </label>
          )}
          {availability && !availability.asap.available && availability.scheduled.slots.length === 0 && (
            <p className={styles.formError}>No pickup times are currently available.</p>
          )}
          {availability?.timezone && <small>Times shown in {availability.timezone}.</small>}
        </fieldset>

        <fieldset className={styles.checkoutFieldset}>
          <legend>Tip</legend>
          <div className={styles.tipChoices}>
            {tipChoices.map((choice) => (
              <label key={choice.value}>
                <input type="radio" name="tip" checked={tipChoice === choice.value} onChange={() => setTipChoice(choice.value)} />
                {choice.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className={styles.orderNotes}>Order notes <small>Optional</small><textarea maxLength={1000} rows={3} value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} /></label>

        {submitError && <p className={styles.formError} role="alert">{submitError}</p>}
        <button className={styles.checkoutButton} type="submit" disabled={submitting || !canPickup || lines.length === 0}>
          {submitting ? "Creating Order…" : "Create Order"}
        </button>
        <small>No payment is collected yet. The order will remain pending payment.</small>
      </form>
    </section>
  );
}
