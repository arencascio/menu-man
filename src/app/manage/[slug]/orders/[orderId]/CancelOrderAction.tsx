"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { managedCancellationResultSchema } from "@/lib/order-management/contracts";
import styles from "../orders.module.css";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default function CancelOrderAction({
  slug, restaurantId, orderId, orderNumber, pickupAt, pickupTimezone,
  capturedCents, refundedCents, pendingRefundCents, currency,
}: {
  slug: string;
  restaurantId: string;
  orderId: string;
  orderNumber: string;
  pickupAt: string;
  pickupTimezone: string;
  capturedCents: number;
  refundedCents: number;
  pendingRefundCents: number;
  currency: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const actionIdRef = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundRequired, setRefundRequired] = useState<number | null>(null);
  const remainingCaptured = Math.max(capturedCents - refundedCents, 0);
  const pickupLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: pickupTimezone, weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(pickupAt));

  function open() {
    actionIdRef.current = crypto.randomUUID();
    setError(null);
    dialogRef.current?.showModal();
    dialogRef.current?.querySelector<HTMLElement>("#cancel-order-title")?.focus({ preventScroll: true });
  }

  async function submit() {
    if (pending || !actionIdRef.current) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/manage/restaurants/${encodeURIComponent(slug)}/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientActionId: actionIdRef.current }),
      });
      const payload: unknown = await response.json();
      if (response.status === 401 || response.status === 403) {
        window.dispatchEvent(new Event("menu-man-management-access-lost"));
        return;
      }
      if (!response.ok) throw new Error(typeof payload === "object" && payload && "error" in payload
        ? String(payload.error) : "Order could not be cancelled.");
      const result = managedCancellationResultSchema.parse(payload);
      setCancelled(true);
      setRefundRequired(result.refundRequiredCents);
      dialogRef.current?.close();
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(`menu-man-orders:${restaurantId}`);
        channel.postMessage({ orderId });
        channel.close();
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order could not be cancelled.");
    } finally {
      setPending(false);
    }
  }

  return <>
    {cancelled ? <p role="status">Order cancelled.{refundRequired ? ` ${money(refundRequired, currency)} remains unrefunded.` : ""}</p>
      : <button type="button" onClick={open}>Cancel Order</button>}
    <dialog ref={dialogRef} className={styles.refundDialog} aria-labelledby="cancel-order-title" onCancel={(event) => { if (pending) event.preventDefault(); }}>
      <div className={styles.cancelDialogContent}>
        <div className={styles.dialogHeader}>
          <div><p className={styles.eyebrow}>Order #{orderNumber}</p><h2 id="cancel-order-title" tabIndex={-1}>Cancel order?</h2></div>
          <button className={styles.dialogClose} type="button" aria-label="Close cancellation dialog" disabled={pending} onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        <p>Pickup: {pickupLabel}</p>
        <p>{capturedCents > 0 ? `Payment captured: ${money(capturedCents, currency)}.` : "No payment has been captured."}</p>
        {remainingCaptured > 0 ? <p className={styles.refundWarning}>
          {money(remainingCaptured, currency)} remains unrefunded. Cancelling the order does not refund the payment.
          {pendingRefundCents > 0 ? " A refund is already in progress; review its outcome before issuing another." : " Use the existing refund action after cancellation, or arrange manual follow-up if a provider refund is unavailable."}
        </p> : capturedCents > 0 ? <p>The captured payment has already been fully refunded.</p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <div className={styles.dialogActions}>
          <button className={styles.secondaryButton} type="button" disabled={pending} onClick={() => dialogRef.current?.close()}>Keep order</button>
          <button className={styles.dangerButton} type="button" disabled={pending} onClick={() => void submit()}>{pending ? "Cancelling…" : "Confirm cancellation"}</button>
        </div>
      </div>
    </dialog>
  </>;
}
