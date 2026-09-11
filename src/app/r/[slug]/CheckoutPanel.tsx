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
import { paymentStatusSchema } from "@/lib/payments/contracts";
import {
  getCustomerPaymentStatusLabel,
  getPaymentProcessingPresentation,
  isServerMarkedPaymentExpired,
  LONG_PROCESSING_THRESHOLD_MS,
  paymentLocksCart,
} from "@/lib/payments/state";
import type { PaymentStatus } from "@/lib/payments/types";
import styles from "./menu-browser.module.css";

type CheckoutPanelProps = {
  restaurantId: string;
  restaurantSlug: string;
  menuId: string;
  currency: string;
  lines: CartLine[];
  onBack: () => void;
  onPaymentConfirmed: () => void;
  onActivePaymentChange: (payment: ActivePaymentOrderSummary | null) => void;
};

export type ActivePaymentOrderSummary = {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  statusLabel: string;
  locksCart: boolean;
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
  onPaymentConfirmed,
  onActivePaymentChange,
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
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [fakeScenario, setFakeScenario] = useState("success");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [recoverySubmitting, setRecoverySubmitting] = useState<"succeeded" | "failed" | null>(null);
  const [longProcessing, setLongProcessing] = useState(false);
  const attempt = useRef<IdempotencyAttempt | null>(null);
  const paymentAttempt = useRef<string | null>(null);
  const clearedPaidCart = useRef(false);
  const attemptStorageKey = `menu-man:checkout-attempt:v1:${restaurantId}`;
  const paymentStorageKey = `menu-man:payment-session:v1:${restaurantId}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    try {
      const storedValue = window.sessionStorage.getItem(paymentStorageKey);
      if (!storedValue) return () => controller.abort();
      const storedOrder = checkoutResponseSchema.parse(JSON.parse(storedValue));
      if (!storedOrder.paymentSession) return () => controller.abort();
      void Promise.resolve().then(() => {
        if (!active) return;
        setConfirmation(storedOrder);
        setPayment(storedOrder.paymentSession?.payment || null);
      });
      void fetch(`/api/orders/${encodeURIComponent(storedOrder.orderId)}/payment-status`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${storedOrder.paymentSession.checkoutToken}` },
        signal: controller.signal,
      }).then(async (response) => {
        if (active && response.ok) setPayment(paymentStatusSchema.parse(await response.json()));
      }).catch(() => {
        // The regular payment UI remains available if resume status cannot be loaded.
      });
    } catch {
      window.sessionStorage.removeItem(paymentStorageKey);
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, [paymentStorageKey]);

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

  useEffect(() => {
    const session = confirmation?.paymentSession;
    const shouldPoll = payment?.status === "processing"
      || payment?.status === "authorized"
      || payment?.status === "cancelled";
    if (!session || !shouldPoll) return;
    let active = true;
    let polling = false;
    const interval = window.setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(confirmation.orderId)}/payment-status`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${session.checkoutToken}` },
        });
        if (!response.ok) return;
        if (active) setPayment(paymentStatusSchema.parse(await response.json()));
      } catch {
        // Polling is best-effort; the next poll can recover from transient failures.
      } finally {
        polling = false;
      }
    }, 1_500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [confirmation, payment?.status]);

  const processingIdentity = payment?.status === "processing"
    ? payment.latestAttempt?.attemptId || payment.paymentId
    : null;

  useEffect(() => {
    if (!processingIdentity || payment?.latestAttempt?.status === "unknown") return;
    const timeout = window.setTimeout(() => setLongProcessing(true), LONG_PROCESSING_THRESHOLD_MS);
    return () => window.clearTimeout(timeout);
  }, [payment?.latestAttempt?.status, processingIdentity]);

  useEffect(() => {
    const session = confirmation?.paymentSession;
    if (
      !confirmation
      || !session
      || !payment
      || payment.orderStatus !== "pending_payment"
      || !["requires_payment_method", "failed"].includes(payment.status)
    ) return;
    const delay = Math.max(0, Date.parse(payment.paymentDueAt) - Date.now()) + 250;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(confirmation.orderId)}/payment-status`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${session.checkoutToken}` },
        });
        if (response.ok) setPayment(paymentStatusSchema.parse(await response.json()));
      } catch {
        // A later resume/status request can safely ask the server to apply expiration.
      }
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [confirmation, payment]);

  useEffect(() => {
    if (!confirmation || !payment) return;
    if (
      payment.orderStatus === "placed"
      && ["paid", "partially_refunded", "refunded"].includes(payment.paymentStatus)
    ) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      onActivePaymentChange({
        orderId: confirmation.orderId,
        orderNumber: confirmation.orderNumber,
        totalCents: confirmation.totalCents,
        currency: confirmation.currency,
        statusLabel: getCustomerPaymentStatusLabel(payment),
        locksCart: paymentLocksCart(payment),
      });
    });
    return () => {
      active = false;
    };
  }, [confirmation, onActivePaymentChange, payment]);

  useEffect(() => {
    if (
      payment?.orderStatus === "placed"
      && ["paid", "partially_refunded", "refunded"].includes(payment.paymentStatus)
      && !clearedPaidCart.current
    ) {
      clearedPaidCart.current = true;
      try {
        window.sessionStorage.removeItem(paymentStorageKey);
      } catch {
        // Payment completion is authoritative even if local cleanup fails.
      }
      onActivePaymentChange(null);
      onPaymentConfirmed();
    }
  }, [onActivePaymentChange, onPaymentConfirmed, payment, paymentStorageKey]);

  async function submitFakePayment() {
    const session = confirmation?.paymentSession;
    if (!confirmation || !session || session.browserSession.provider !== "fake") return;
    setPaymentSubmitting(true);
    setPaymentError(null);
    paymentAttempt.current ||= crypto.randomUUID();
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(confirmation.orderId)}/payments`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutToken: session.checkoutToken,
          clientAttemptKey: paymentAttempt.current,
          paymentMethodToken: `fake:${fakeScenario}`,
        }),
      });
      const body = await response.json() as unknown;
      if (!response.ok) {
        const errorBody = body as { error?: { message?: string } };
        throw new Error(errorBody.error?.message || "Payment could not be submitted.");
      }
      const nextPayment = paymentStatusSchema.parse(body);
      setLongProcessing(false);
      setPayment(nextPayment);
      if (nextPayment.status === "failed") paymentAttempt.current = null;
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Payment could not be submitted.");
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function resolveUnknownPayment(resolution: "succeeded" | "failed") {
    const session = confirmation?.paymentSession;
    if (
      !confirmation
      || !session
      || session.browserSession.provider !== "fake"
      || payment?.latestAttempt?.status !== "unknown"
    ) return;
    setRecoverySubmitting(resolution);
    setPaymentError(null);
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(confirmation.orderId)}/payments/fake-recovery`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutToken: session.checkoutToken, resolution }),
        },
      );
      const body = await response.json() as unknown;
      if (!response.ok) {
        const errorBody = body as { error?: { message?: string } };
        throw new Error(errorBody.error?.message || "Payment status could not be reconciled.");
      }
      const nextPayment = paymentStatusSchema.parse(body);
      setPayment(nextPayment);
      if (nextPayment.status === "failed") paymentAttempt.current = null;
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Payment status could not be reconciled.");
    } finally {
      setRecoverySubmitting(null);
    }
  }

  function startFreshCheckout() {
    if (!payment || !isServerMarkedPaymentExpired(payment)) return;
    try {
      window.sessionStorage.removeItem(paymentStorageKey);
    } catch {
      // Server-confirmed expiration is sufficient even if local cleanup is unavailable.
    }
    paymentAttempt.current = null;
    setConfirmation(null);
    setPayment(null);
    onActivePaymentChange(null);
    onBack();
  }

  if (confirmation) {
    const session = confirmation.paymentSession;
    const fakeScenarios = session?.browserSession.provider === "fake"
      ? session.browserSession.publicConfig.scenarios as string[] | undefined
      : undefined;
    const isPlaced = payment?.orderStatus === "placed";
    const isExpired = payment ? isServerMarkedPaymentExpired(payment) : false;
    const isLateSuccess = payment?.status === "succeeded" && !isPlaced;
    const processingPresentation = getPaymentProcessingPresentation(payment, longProcessing);
    const canRecoverUnknown = session?.browserSession.provider === "fake"
      && session.browserSession.publicConfig.unknownRecoveryEnabled === true
      && payment?.latestAttempt?.status === "unknown";
    return (
      <section className={styles.checkoutPanel} aria-live="polite">
        <p className={styles.expandedLabel}>{isPlaced ? "Order placed" : "Order created"}</p>
        <h2>Order #{confirmation.orderNumber}</h2>
        <p className={styles.confirmationTotal}>{formatPrice(confirmation.totalCents, confirmation.currency)}</p>
        {isPlaced ? (
          <p>Payment was verified by the server and the order has been placed with the restaurant.</p>
        ) : isLateSuccess ? (
          <div className={styles.paymentWarningPanel} role="status">
            <h3>Payment confirmed after the order deadline</h3>
            <p>This order was not placed automatically. The payment requires restaurant review or a refund.</p>
          </div>
        ) : isExpired ? (
          <div className={styles.paymentNoticePanel} role="status">
            <h3>Payment expired</h3>
            <p>The server has expired this unpaid order. You can now safely start a fresh checkout.</p>
          </div>
        ) : payment?.orderStatus === "cancelled" ? (
          <p className={styles.formError}>This order is cancelled. A late payment requires review or refund.</p>
        ) : (
          <p>This order is awaiting payment and has not been placed with the restaurant yet.</p>
        )}
        <dl className={styles.authoritativeTotals}>
          <div><dt>Subtotal</dt><dd>{formatPrice(confirmation.subtotalCents, confirmation.currency)}</dd></div>
          <div><dt>Tax</dt><dd>{formatPrice(confirmation.taxCents, confirmation.currency)}</dd></div>
          <div><dt>Tip</dt><dd>{formatPrice(confirmation.tipCents, confirmation.currency)}</dd></div>
          <div><dt>Total</dt><dd>{formatPrice(confirmation.totalCents, confirmation.currency)}</dd></div>
        </dl>
        {!session && (
          <p className={styles.formError}>No payment provider is currently configured for this restaurant.</p>
        )}
        {session && processingPresentation === "short" && (
          <div className={styles.paymentNoticePanel} role="status">
            <h3>Payment is processing</h3>
            <p>This usually takes a few moments. We will update this order after the provider confirms it.</p>
          </div>
        )}
        {session && processingPresentation === "uncertain" && (
          <div className={styles.paymentWarningPanel} role="status">
            <h3>We&apos;re still confirming this payment. Don&apos;t submit another payment yet.</h3>
            <p>Your order will not be lost. Keep this page open while we check for a verified update, and do not retry while the payment status is uncertain.</p>
            {canRecoverUnknown && (
              <div className={styles.fakeRecoveryControls}>
                <p><strong>Staging recovery:</strong> resolve this original test attempt without creating another payment.</p>
                <button
                  type="button"
                  disabled={recoverySubmitting !== null}
                  onClick={() => void resolveUnknownPayment("succeeded")}
                >
                  {recoverySubmitting === "succeeded" ? "Resolving…" : "Resolve as succeeded"}
                </button>
                <button
                  type="button"
                  disabled={recoverySubmitting !== null}
                  onClick={() => void resolveUnknownPayment("failed")}
                >
                  {recoverySubmitting === "failed" ? "Resolving…" : "Resolve as failed"}
                </button>
              </div>
            )}
          </div>
        )}
        {session && payment?.status === "authorized" && (
          <p>Payment is authorized but has not been captured. The order remains pending payment.</p>
        )}
        {session && payment?.status === "failed" && (
          <div className={styles.paymentErrorPanel} role="alert">
            <h3>Payment declined</h3>
            <p>The payment was declined, so this order has not been placed.</p>
            <p>Common reasons include:</p>
            <ul>
              <li>Card information could not be verified</li>
              <li>Insufficient funds or a bank restriction</li>
              <li>The bank declined the transaction for security reasons</li>
            </ul>
            <p>Check the payment details and retry, or use another payment method.</p>
          </div>
        )}
        {session && session.browserSession.provider === "fake" && !isPlaced
          && payment?.status !== "processing" && payment?.status !== "authorized"
          && payment?.orderStatus !== "cancelled" && (
          <fieldset className={styles.checkoutFieldset}>
            <legend>Fake payment provider</legend>
            <label>
              Test case
              <select value={fakeScenario} onChange={(event) => {
                setFakeScenario(event.target.value);
                paymentAttempt.current = null;
              }}>
                {(fakeScenarios || []).map((scenario) => (
                  <option key={scenario} value={scenario}>{scenario.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <small>No card details are collected. This provider is restricted to non-production environments.</small>
            {paymentError && <p className={styles.formError} role="alert">{paymentError}</p>}
            <button
              className={styles.checkoutButton}
              type="button"
              disabled={paymentSubmitting}
              onClick={() => void submitFakePayment()}
            >
              {paymentSubmitting ? "Submitting Test Payment…" : "Submit Test Payment"}
            </button>
          </fieldset>
        )}
        {isExpired && (
          <button className={styles.checkoutButton} type="button" onClick={startFreshCheckout}>
            Start a Fresh Checkout
          </button>
        )}
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
      setPayment(order.paymentSession?.payment || null);
      if (order.paymentSession) {
        try {
          window.sessionStorage.setItem(paymentStorageKey, JSON.stringify(order));
        } catch {
          // The active page can still finish payment when session storage is unavailable.
        }
      }
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
        <small className={styles.checkoutActionHint}>You&apos;ll enter payment details next. You won&apos;t be charged yet.</small>
        <button className={styles.checkoutButton} type="submit" disabled={submitting || !canPickup || lines.length === 0}>
          {submitting ? "Continuing to Payment…" : "Continue to Payment"}
        </button>
      </form>
    </section>
  );
}
