"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics/client";
import { calculateLineTotalCents, formatPrice } from "@/lib/cart/cart";
import { loadCheckoutDraft, saveCheckoutDraft } from "@/lib/checkout/draft";
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
import { formatPickupDateTime } from "@/lib/checkout/pickup-presentation";
import {
  customerValidationError,
  type CheckoutCustomerRequirements,
} from "@/lib/checkout/customer-details";
import { checkoutNotificationMessage, type CustomerNotificationPreferences } from "@/lib/checkout/notification-message";
import {
  parseCustomTipCents,
  reconcileLargeTipConfirmation,
  requiresLargeTipConfirmation,
  type LargeTipConfirmation,
} from "@/lib/checkout/tips";
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
  customerRequirements: CheckoutCustomerRequirements;
  notificationPreferences: CustomerNotificationPreferences;
};

type IdempotencyAttempt = { fingerprint: string; key: string };

const tipChoices: Array<{ value: TipChoice; label: string }> = [
  { value: "none", label: "No tip" },
  { value: "10_percent", label: "10%" },
  { value: "15_percent", label: "15%" },
  { value: "20_percent", label: "20%" },
  { value: "custom", label: "Custom" },
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
  customerRequirements,
  notificationPreferences,
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
  const [customTipAmount, setCustomTipAmount] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [largeTipConfirmation, setLargeTipConfirmation] = useState<LargeTipConfirmation | null>(null);
  const attempt = useRef<IdempotencyAttempt | null>(null);
  const customTipInput = useRef<HTMLInputElement>(null);
  const largeTipPrompt = useRef<HTMLDivElement>(null);
  const restoredPickup = useRef<{ mode: "asap" } | { mode: "scheduled"; pickupAt: string } | undefined>(undefined);
  const attemptStorageKey = `menu-man:checkout-attempt:v1:${restaurantId}`;

  useEffect(() => {
    const draft = loadCheckoutDraft(window.sessionStorage, restaurantId);
    const hydration = window.setTimeout(() => {
      if (draft) {
        setCustomerName(draft.customerName);
        setPhone(draft.phone);
        setEmail(draft.email);
        setPickupMode(draft.pickup.mode);
        setPickupAt(draft.pickup.mode === "scheduled" ? draft.pickup.pickupAt : "");
        setTipChoice(draft.tipChoice);
        setCustomTipAmount(draft.customTipAmount);
        setOrderNotes(draft.orderNotes);
        restoredPickup.current = draft.pickup;
      }
      setDraftHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [restaurantId]);

  useEffect(() => {
    if (!draftHydrated) return;
    try {
      saveCheckoutDraft(window.sessionStorage, {
        restaurantId,
        customerName,
        phone,
        email,
        pickup: pickupMode === "asap" ? { mode: "asap" } : { mode: "scheduled", pickupAt },
        tipChoice,
        customTipAmount,
        orderNotes,
      });
    } catch {
      // Draft retention is a convenience; checkout remains functional without storage.
    }
  }, [customTipAmount, customerName, draftHydrated, email, orderNotes, phone, pickupAt, pickupMode, restaurantId, tipChoice]);

  useEffect(() => {
    if (!draftHydrated) return;
    const controller = new AbortController();
    void fetch(`/api/restaurants/${encodeURIComponent(restaurantSlug)}/pickup-availability`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Pickup availability could not be loaded.");
      const nextAvailability = await response.json() as PickupAvailability;
      setAvailability(nextAvailability);
      const nextSelection = resolvePickupSelection(nextAvailability, restoredPickup.current);
      restoredPickup.current = undefined;
      if (nextSelection) {
        setPickupMode(nextSelection.mode);
        setPickupAt(nextSelection.mode === "scheduled" ? nextSelection.pickupAt : "");
      } else {
        setPickupMode(nextAvailability.scheduled.slots.length > 0 ? "scheduled" : "asap");
        setPickupAt("");
      }
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setAvailabilityError(error instanceof Error ? error.message : "Pickup availability could not be loaded.");
      }
    });
    return () => controller.abort();
  }, [draftHydrated, restaurantSlug]);

  const canPickup = isPickupSelectionAvailable(
    availability,
    pickupMode === "asap" ? { mode: "asap" } : { mode: "scheduled", pickupAt },
  );
  const selectedPickupAt = pickupMode === "asap"
    ? availability?.asap.estimatedPickupAt
    : pickupAt;
  const selectedPickupLabel = selectedPickupAt && availability?.timezone
    ? formatPickupDateTime(selectedPickupAt, availability.timezone)
    : null;

  const parsedCustomTipCents = tipChoice === "custom"
    ? parseCustomTipCents(customTipAmount)
    : null;
  const notificationMessage = checkoutNotificationMessage(notificationPreferences, email);
  const closedWithFuturePickup = Boolean(
    availability && !availability.currentlyOpen
      && availability.scheduled.enabled && availability.scheduled.slots.length > 0,
  );
  const orderingUnavailable = Boolean(
    availability && !availability.currentlyOpen && !closedWithFuturePickup,
  );

  const activeLargeTipConfirmation = reconcileLargeTipConfirmation(
    largeTipConfirmation,
    tipChoice,
    parsedCustomTipCents,
    cart.subtotalCents,
  );

  useEffect(() => {
    if (activeLargeTipConfirmation) largeTipPrompt.current?.focus();
  }, [activeLargeTipConfirmation]);

  async function submitCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const isLargeTipConfirmed = submitter instanceof HTMLButtonElement
      && submitter.dataset.largeTipConfirmed === "true";
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
      customTipCents: tipChoice === "custom" ? parseCustomTipCents(customTipAmount) : null,
      largeTipConfirmed: isLargeTipConfirmed,
      largeTipConfirmedSubtotalCents: isLargeTipConfirmed
        ? activeLargeTipConfirmation?.subtotalCents
        : null,
      orderNotes,
    });
    if (!parsedRequest.success) {
      setSubmitError(parsedRequest.error.issues[0]?.message || "Check the checkout form and try again.");
      return;
    }
    const customerError = customerValidationError(parsedRequest.data.customer, customerRequirements);
    if (customerError) {
      setSubmitError(customerError);
      return;
    }

    const confirmationSubtotal = activeLargeTipConfirmation?.subtotalCents
      ?? cart.subtotalCents;
    if (requiresLargeTipConfirmation(
      parsedRequest.data.tipChoice,
      parsedRequest.data.customTipCents || 0,
      confirmationSubtotal,
    )) {
      const matchingConfirmation = reconcileLargeTipConfirmation(
        activeLargeTipConfirmation,
        parsedRequest.data.tipChoice,
        parsedRequest.data.customTipCents,
        cart.subtotalCents,
      );
      if (!isLargeTipConfirmed || !matchingConfirmation) {
        setLargeTipConfirmation({
          tipCents: parsedRequest.data.customTipCents || 0,
          subtotalCents: confirmationSubtotal,
          cartSubtotalCents: cart.subtotalCents,
        });
        return;
      }
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
        const errorBody = body as {
          error?: {
            code?: string;
            message?: string;
            authoritativeSubtotalCents?: number;
          };
        };
        if (
          errorBody.error?.code === "LARGE_TIP_CONFIRMATION_REQUIRED"
          && Number.isSafeInteger(errorBody.error.authoritativeSubtotalCents)
          && (errorBody.error.authoritativeSubtotalCents || 0) >= 0
        ) {
          setLargeTipConfirmation({
            tipCents: parsedRequest.data.customTipCents || 0,
            subtotalCents: errorBody.error.authoritativeSubtotalCents!,
            cartSubtotalCents: cart.subtotalCents,
          });
          return;
        }
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

  function changeLargeTip() {
    setLargeTipConfirmation(null);
    customTipInput.current?.focus();
  }

  return (
    <main className={styles.page} aria-label="Checkout details">
      <section className={styles.checkoutPanel}>
        <div className={styles.cartHeader}>
          <div><p className={styles.expandedLabel}>Checkout</p><h1>Review your order</h1></div>
          <Link className={styles.closeButton} href={`/r/${restaurantSlug}/menu`}>Back to Menu</Link>
        </div>

        <div className={styles.checkoutReview}>
          {cart.lines.map((line) => (
            <div className={styles.checkoutReviewLine} key={line.lineId}>
              <span>{line.itemName}</span>
              <span className={styles.checkoutQuantityActions}>
                <button type="button" disabled={submitting} onClick={() => { setLargeTipConfirmation(null); cart.setLineQuantity(line.lineId, line.quantity - 1); }} aria-label={`Decrease ${line.itemName}`}>−</button>
                {line.quantity}
                <button type="button" disabled={submitting} onClick={() => { setLargeTipConfirmation(null); cart.setLineQuantity(line.lineId, line.quantity + 1); }} aria-label={`Increase ${line.itemName}`}>+</button>
                <button type="button" disabled={submitting} onClick={() => { setLargeTipConfirmation(null); cart.removeLine(line.lineId); }}>Remove</button>
              </span>
              <strong>{formatPrice(calculateLineTotalCents(line), currency)}</strong>
            </div>
          ))}
          <div><span>Estimated subtotal</span><strong>{formatPrice(cart.subtotalCents, currency)}</strong></div>
          <small>The server will verify all prices and calculate tax, tip, and the final total.</small>
        </div>

        <form className={styles.checkoutForm} onSubmit={submitCheckout}>
          <section className={styles.pickupSummary} aria-label="Selected pickup time">
            <div>
              <p className={styles.expandedLabel}>Pickup</p>
              <strong>{selectedPickupLabel || "Select a pickup time"}</strong>
              {selectedPickupLabel && <small>{pickupMode === "asap" ? "ASAP pickup" : "Scheduled pickup"}</small>}
            </div>
            <a className={styles.pickupEditLink} href="#pickup-details">Edit</a>
          </section>
          <div className={styles.checkoutFields}>
            <label>Name {!customerRequirements.customerNameRequired && <small>Optional</small>}<input required={customerRequirements.customerNameRequired} maxLength={100} autoComplete="name" type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
            <label>Phone {!customerRequirements.customerPhoneRequired && <small>Optional</small>}<input required={customerRequirements.customerPhoneRequired} maxLength={30} autoComplete="tel" inputMode="tel" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label>Email {!customerRequirements.customerEmailRequired && <small>Optional</small>}<input required={customerRequirements.customerEmailRequired} maxLength={254} autoComplete="email" inputMode="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          </div>
          <fieldset className={styles.checkoutFieldset} id="pickup-details">
            <legend>Pickup</legend>
            {availabilityError && <p className={styles.formError}>{availabilityError}</p>}
            {closedWithFuturePickup && <p className={styles.pickupNotice}>We&apos;re currently closed, but you can still place an order for a future pickup time.</p>}
            {orderingUnavailable && <p className={styles.formError}>Ordering is currently unavailable.</p>}
            {!availability && !availabilityError && <p>Loading current availability…</p>}
            {availability?.asap.enabled && <label><input type="radio" name="pickup-mode" checked={pickupMode === "asap"} disabled={!availability.asap.available} onChange={() => setPickupMode("asap")} /> ASAP</label>}
            {availability?.scheduled.enabled && availability.scheduled.slots.length > 0 && (
              <label><input type="radio" name="pickup-mode" checked={pickupMode === "scheduled"} onChange={() => setPickupMode("scheduled")} /> Scheduled
                <select required value={pickupAt} onChange={(event) => setPickupAt(event.target.value)} disabled={pickupMode !== "scheduled"}>
                  <option value="">Choose a pickup date and time</option>
                  {availability.scheduled.slots.map((slot) => <option key={slot.pickupAt} value={slot.pickupAt}>{slot.label}</option>)}
                </select>
              </label>
            )}
            {availability?.currentlyOpen && !availability.asap.available && availability.scheduled.slots.length === 0 && <p className={styles.formError}>No pickup times are currently available.</p>}
            {availability?.timezone && <small>Times shown in {availability.timezone}.</small>}
          </fieldset>
          <fieldset className={styles.checkoutFieldset}>
            <legend>Tip</legend>
            <div className={styles.tipChoices}>{tipChoices.map((choice) => <label key={choice.value}><input type="radio" name="tip" checked={tipChoice === choice.value} onChange={() => { setLargeTipConfirmation(null); setTipChoice(choice.value); }} />{choice.label}</label>)}</div>
            {tipChoice === "custom" && (
              <label className={styles.customTipField}>Custom tip
                <span><span aria-hidden="true">$</span><input ref={customTipInput} required inputMode="decimal" placeholder="0.00" value={customTipAmount} onChange={(event) => { setLargeTipConfirmation(null); setCustomTipAmount(event.target.value); }} aria-label="Custom tip amount in dollars" /></span>
              </label>
            )}
          </fieldset>
          <label className={styles.orderNotes}>Order notes <small>Optional</small><textarea maxLength={500} rows={3} value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} /></label>
          {notificationMessage && <p className={styles.emailConfirmation}>{notificationMessage}</p>}
          {submitError && <p className={styles.formError} role="alert">{submitError}</p>}
          {activeLargeTipConfirmation ? (
            <div
              ref={largeTipPrompt}
              className={styles.largeTipConfirmation}
              role="alert"
              aria-live="polite"
              tabIndex={-1}
            >
              <strong>That&apos;s a very generous tip!</strong>
              <p>
                You&apos;re tipping {formatPrice(activeLargeTipConfirmation.tipCents, currency)} on a{" "}
                {formatPrice(activeLargeTipConfirmation.subtotalCents, currency)} order. Are you sure?
              </p>
              <div>
                <button className={styles.checkoutButton} type="submit" data-large-tip-confirmed="true" disabled={submitting}>
                  {submitting
                    ? "Continuing to Payment…"
                    : `Yes, continue with ${formatPrice(activeLargeTipConfirmation.tipCents, currency)} tip`}
                </button>
                <button className={styles.secondaryCheckoutButton} type="button" onClick={changeLargeTip} disabled={submitting}>
                  Change tip
                </button>
              </div>
            </div>
          ) : (
            <>
              <small className={styles.checkoutActionHint}>You&apos;ll enter payment details next. You won&apos;t be charged yet.</small>
              <button className={styles.checkoutButton} type="submit" disabled={submitting || !canPickup || cart.lines.length === 0 || !cart.hydrated}>
                {submitting ? "Continuing to Payment…" : "Continue to Payment"}
              </button>
            </>
          )}
        </form>
      </section>
    </main>
  );
}
