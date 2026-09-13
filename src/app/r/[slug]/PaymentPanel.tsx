"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { paymentStatusSchema, type PaymentSessionResponse } from "@/lib/payments/contracts";
import {
  broadcastCheckoutEvent,
  loadActiveOrderMarker,
  removeActiveOrderMarker,
  saveActiveOrderMarker,
} from "@/lib/payments/browser-session";
import {
  getPaymentProcessingPresentation,
  isServerMarkedPaymentExpired,
  LONG_PROCESSING_THRESHOLD_MS,
  paymentLocksCart,
} from "@/lib/payments/state";
import type { OrderPaymentView } from "@/lib/payments/view-contracts";
import OrderSnapshot from "./OrderSnapshot";
import useRestaurantCart from "./useRestaurantCart";
import styles from "./menu-browser.module.css";

type PaymentPanelProps = {
  restaurantId: string;
  restaurantSlug: string;
  initialView: OrderPaymentView;
  paymentSession: Pick<PaymentSessionResponse, "payment" | "browserSession">;
};

export default function PaymentPanel({
  restaurantId,
  restaurantSlug,
  initialView,
  paymentSession,
}: PaymentPanelProps) {
  const router = useRouter();
  const cart = useRestaurantCart(restaurantId, initialView.order.currency);
  const [payment, setPayment] = useState(initialView.payment);
  const [fakeScenario, setFakeScenario] = useState("success");
  const [submitting, setSubmitting] = useState(false);
  const [recoverySubmitting, setRecoverySubmitting] = useState<"succeeded" | "failed" | null>(null);
  const [authorizationSubmitting, setAuthorizationSubmitting] = useState<"capture" | "void" | null>(null);
  const [authorizationChoice, setAuthorizationChoice] = useState<"capture" | "void" | null>(null);
  const [lateResolutionSubmitting, setLateResolutionSubmitting] = useState<"accepted" | "refunded" | null>(null);
  const [lateResolutionChoice, setLateResolutionChoice] = useState<"accepted" | "refunded" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [longProcessing, setLongProcessing] = useState(false);
  const paymentAttempt = useRef<string | null>(null);
  const authorizationActionKey = useRef<string | null>(null);
  const lateResolutionActionKey = useRef<string | null>(null);
  const completedNavigation = useRef(false);
  const order = initialView.order;

  useEffect(() => {
    if (loadActiveOrderMarker(window.localStorage, restaurantId)?.orderId === order.orderId) return;
    saveActiveOrderMarker(window.localStorage, {
      version: 1,
      restaurantId,
      restaurantSlug,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      cartFingerprint: "",
    });
    broadcastCheckoutEvent(restaurantId, "order_created");
  }, [order.orderId, order.orderNumber, restaurantId, restaurantSlug]);

  const processingIdentity = payment.status === "processing"
    ? payment.latestAttempt?.attemptId || payment.paymentId
    : null;

  useEffect(() => {
    if (!processingIdentity || payment.latestAttempt?.status === "unknown") return;
    const timeout = window.setTimeout(() => setLongProcessing(true), LONG_PROCESSING_THRESHOLD_MS);
    return () => window.clearTimeout(timeout);
  }, [payment.latestAttempt?.status, processingIdentity]);

  useEffect(() => {
    const shouldPoll = paymentLocksCart(payment)
      || payment.status === "cancelled";
    if (!shouldPoll) return;
    let active = true;
    let polling = false;
    const interval = window.setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}/payment-status`, { cache: "no-store" });
        if (response.ok && active) {
          setPayment(paymentStatusSchema.parse(await response.json()));
          broadcastCheckoutEvent(restaurantId, "payment_changed");
        }
      } catch {
        // The next poll retries; browser observations never decide payment state.
      } finally {
        polling = false;
      }
    }, 1_500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [order.orderId, payment, restaurantId]);

  useEffect(() => {
    if (completedNavigation.current) return;
    if (payment.orderStatus === "placed" && ["paid", "partially_refunded", "refunded"].includes(payment.paymentStatus)) {
      if (!cart.hydrated) return;
      completedNavigation.current = true;
      const marker = loadActiveOrderMarker(window.localStorage, restaurantId);
      void (async () => {
        if (marker?.orderId === order.orderId) {
          await cart.clearIfFingerprintMatches(marker.cartFingerprint);
          removeActiveOrderMarker(window.localStorage, restaurantId);
        }
        broadcastCheckoutEvent(restaurantId, "payment_terminal");
        router.replace(`/r/${encodeURIComponent(restaurantSlug)}/order/${encodeURIComponent(order.orderId)}/confirmation`);
      })();
      return;
    }
    if (!paymentLocksCart(payment)) {
      removeActiveOrderMarker(window.localStorage, restaurantId);
      broadcastCheckoutEvent(restaurantId, "payment_terminal");
    }
  }, [cart, order.orderId, payment, restaurantId, restaurantSlug, router]);

  async function submitFakePayment() {
    if (paymentSession.browserSession.provider !== "fake" || !paymentLocksCart(payment)) return;
    setSubmitting(true);
    setError(null);
    paymentAttempt.current ||= crypto.randomUUID();
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}/payments`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientAttemptKey: paymentAttempt.current,
          paymentMethodToken: `fake:${fakeScenario}`,
        }),
      });
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error((body as { error?: { message?: string } }).error?.message || "Payment could not be submitted.");
      const nextPayment = paymentStatusSchema.parse(body);
      setLongProcessing(false);
      setPayment(nextPayment);
      if (nextPayment.status === "failed") paymentAttempt.current = null;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Payment could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resolveUnknownPayment(resolution: "succeeded" | "failed") {
    if (payment.latestAttempt?.status !== "unknown") return;
    setRecoverySubmitting(resolution);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}/payments/fake-recovery`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error((body as { error?: { message?: string } }).error?.message || "Payment could not be reconciled.");
      setPayment(paymentStatusSchema.parse(body));
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : "Payment could not be reconciled.");
    } finally {
      setRecoverySubmitting(null);
    }
  }

  async function resolveAuthorization(action: "capture" | "void") {
    if (payment.status !== "authorized" || (authorizationChoice && authorizationChoice !== action)) return;
    setAuthorizationChoice(action);
    setAuthorizationSubmitting(action);
    setError(null);
    authorizationActionKey.current ||= crypto.randomUUID();
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}/payments/fake-authorization`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, clientActionKey: authorizationActionKey.current }),
      });
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error((body as { error?: { message?: string } }).error?.message || "The authorization could not be updated.");
      setPayment(paymentStatusSchema.parse(body));
      broadcastCheckoutEvent(restaurantId, "payment_changed");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The authorization could not be updated.");
    } finally {
      setAuthorizationSubmitting(null);
    }
  }

  async function resolveLateSuccess(resolution: "accepted" | "refunded") {
    if (
      payment.status !== "succeeded"
      || payment.orderStatus === "placed"
      || (lateResolutionChoice && lateResolutionChoice !== resolution)
    ) return;
    setLateResolutionChoice(resolution);
    setLateResolutionSubmitting(resolution);
    setError(null);
    lateResolutionActionKey.current ||= crypto.randomUUID();
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}/payments/fake-late-success`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, clientActionKey: lateResolutionActionKey.current }),
      });
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error((body as { error?: { message?: string } }).error?.message || "The payment could not be resolved.");
      setPayment(paymentStatusSchema.parse(body));
      broadcastCheckoutEvent(restaurantId, "payment_changed");
    } catch (resolutionError) {
      setError(resolutionError instanceof Error ? resolutionError.message : "The payment could not be resolved.");
    } finally {
      setLateResolutionSubmitting(null);
    }
  }

  const isPlaced = payment.orderStatus === "placed";
  const isExpired = isServerMarkedPaymentExpired(payment);
  const isLateSuccess = payment.status === "succeeded" && !isPlaced;
  const isLateSuccessRefunded = payment.status === "refunded" && payment.orderStatus === "cancelled";
  const processingPresentation = getPaymentProcessingPresentation(payment, longProcessing);
  const fakeScenarios = paymentSession.browserSession.provider === "fake"
    ? paymentSession.browserSession.publicConfig.scenarios as string[] | undefined
    : undefined;
  const canRecoverUnknown = paymentSession.browserSession.provider === "fake"
    && paymentSession.browserSession.publicConfig.unknownRecoveryEnabled === true
    && payment.latestAttempt?.status === "unknown";
  const terminalFailure = payment.status === "failed" && payment.orderStatus === "cancelled";
  const authorizationVoided = terminalFailure
    && payment.latestAttempt?.failureCategory === "authorization_voided";
  const terminalDecline = terminalFailure
    && payment.latestAttempt?.failureCategory === "provider_decline";
  const canUseFakeExceptionControls = paymentSession.browserSession.provider === "fake"
    && paymentSession.browserSession.publicConfig.exceptionControlsEnabled === true;
  const cancelledPendingReconciliation = payment.status === "cancelled"
    && payment.orderStatus === "cancelled"
    && paymentLocksCart(payment);

  return (
    <main className={styles.page} aria-label="Order payment">
      <section className={styles.checkoutPanel} aria-live="polite">
        <p className={styles.expandedLabel}>Payment</p>
        <h1>Order #{order.orderNumber}</h1>
        <p>This total is frozen from the authoritative order snapshot.</p>
        <OrderSnapshot order={order} />

        {processingPresentation === "short" && <div className={styles.paymentNoticePanel}><h3>Payment is processing</h3><p>This usually takes a few moments. We will update this order after the provider confirms it.</p></div>}
        {processingPresentation === "uncertain" && (
          <div className={styles.paymentWarningPanel}>
            <h3>We&apos;re still confirming this payment. Don&apos;t submit another payment yet.</h3>
            <p>Your order will not be lost. Do not retry while payment status is uncertain.</p>
            {canRecoverUnknown && <div className={styles.fakeRecoveryControls}><p><strong>Staging recovery:</strong> resolve the original attempt without creating another payment.</p><button type="button" disabled={recoverySubmitting !== null} onClick={() => void resolveUnknownPayment("succeeded")}>Resolve as succeeded</button><button type="button" disabled={recoverySubmitting !== null} onClick={() => void resolveUnknownPayment("failed")}>Resolve as failed</button></div>}
          </div>
        )}
        {payment.status === "authorized" && (
          <div className={styles.paymentWarningPanel}>
            <h3>Payment authorized</h3>
            <p>The payment has not been captured. Do not submit another payment.</p>
            {canUseFakeExceptionControls && (
              <div className={styles.fakeRecoveryControls}>
                <p><strong>Staging authorization controls:</strong> resolve this existing authorization without creating another payment attempt.</p>
                <button type="button" disabled={authorizationSubmitting !== null || authorizationChoice === "void"} onClick={() => void resolveAuthorization("capture")}>{authorizationSubmitting === "capture" ? "Capturing…" : "Capture Payment"}</button>
                <button type="button" disabled={authorizationSubmitting !== null || authorizationChoice === "capture"} onClick={() => void resolveAuthorization("void")}>{authorizationSubmitting === "void" ? "Voiding…" : "Void Authorization"}</button>
              </div>
            )}
          </div>
        )}
        {terminalDecline && (
          <div className={styles.paymentErrorPanel} role="alert"><h3>Payment declined</h3><p>The payment was declined and this order was not placed.</p><p>Common reasons include:</p><ul><li>Card information could not be verified</li><li>Insufficient funds or a bank restriction</li><li>The bank declined the transaction for security reasons</li></ul><p>Your cart is unlocked. Edit it or begin a fresh checkout.</p></div>
        )}
        {authorizationVoided && <div className={styles.paymentNoticePanel}><h3>Authorization voided</h3><p>The authorization was cancelled with the provider. No payment was captured, and your cart is unlocked.</p></div>}
        {terminalFailure && !terminalDecline && !authorizationVoided && <div className={styles.paymentErrorPanel} role="alert"><h3>Payment unsuccessful</h3><p>This payment could not be completed, the order was not placed, and your cart is unlocked.</p></div>}
        {isExpired && <div className={styles.paymentNoticePanel}><h3>Payment expired</h3><p>The server expired this unpaid order. Your cart is now available for a fresh checkout.</p></div>}
        {cancelledPendingReconciliation && (
          <div className={styles.paymentWarningPanel}>
            <h3>We&apos;re still confirming this payment</h3>
            <p>Please don&apos;t submit another payment while we confirm its final status.</p>
          </div>
        )}
        {isLateSuccess && (
          <div className={styles.paymentWarningPanel}>
            <h3>We&apos;re confirming your order</h3>
            <p>We received your payment. Please don&apos;t submit another payment while we confirm the order with the restaurant.</p>
            {canUseFakeExceptionControls && (
              <div className={styles.fakeRecoveryControls}>
                <p><strong>Staging late-success controls:</strong> choose one final resolution for this payment.</p>
                <button type="button" disabled={lateResolutionSubmitting !== null || lateResolutionChoice === "refunded"} onClick={() => void resolveLateSuccess("accepted")}>{lateResolutionSubmitting === "accepted" ? "Placing…" : "Resolve as Accepted / Placed"}</button>
                <button type="button" disabled={lateResolutionSubmitting !== null || lateResolutionChoice === "accepted"} onClick={() => void resolveLateSuccess("refunded")}>{lateResolutionSubmitting === "refunded" ? "Refunding…" : "Resolve as Refunded"}</button>
              </div>
            )}
          </div>
        )}
        {isLateSuccessRefunded && <div className={styles.paymentNoticePanel}><h3>Payment refunded</h3><p>The payment was refunded and the order was not placed. Your cart is unlocked.</p></div>}

        {paymentSession.browserSession.provider === "fake" && payment.status !== "processing" && payment.status !== "authorized" && payment.orderStatus === "pending_payment" && (
          <fieldset className={styles.checkoutFieldset}>
            <legend>Fake payment provider</legend>
            <label>Test case<select value={fakeScenario} onChange={(event) => { setFakeScenario(event.target.value); paymentAttempt.current = null; }}>{(fakeScenarios || []).map((scenario) => <option key={scenario} value={scenario}>{scenario.replaceAll("_", " ")}</option>)}</select></label>
            <small>No card details are collected. This provider is restricted to non-production environments.</small>
            <button className={styles.checkoutButton} type="button" disabled={submitting} onClick={() => void submitFakePayment()}>{submitting ? "Submitting Test Payment…" : "Submit Test Payment"}</button>
          </fieldset>
        )}
        {error && <p className={styles.formError} role="alert">{error}</p>}
        {(terminalFailure || isExpired || isLateSuccessRefunded) && <Link className={styles.checkoutButton} href={`/r/${restaurantSlug}/checkout`}>Back to Checkout Details</Link>}
        <Link className={styles.checkoutButton} href={`/r/${restaurantSlug}`}>Return to Menu</Link>
      </section>
    </main>
  );
}
