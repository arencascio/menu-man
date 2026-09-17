"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { managedRefundResultSchema } from "@/lib/order-management/contracts";
import styles from "../orders.module.css";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function centsFromInput(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export default function RefundAction({
  slug,
  restaurantId,
  orderId,
  originalTotalCents,
  refundedCents,
  refundableCents,
  pendingRefundCents,
  currency,
  policyEligible,
  providerAvailable,
}: {
  slug: string;
  restaurantId: string;
  orderId: string;
  originalTotalCents: number;
  refundedCents: number;
  refundableCents: number;
  pendingRefundCents: number;
  currency: string;
  policyEligible: boolean;
  providerAvailable: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [clientActionId, setClientActionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const partialCents = centsFromInput(partialAmount);
  const amountCents = mode === "full" ? refundableCents : partialCents;
  const eligible = refundableCents > 0 && policyEligible && providerAvailable;

  function open() {
    setMode("full");
    setPartialAmount("");
    setReason("");
    setStep("edit");
    setError(null);
    setClientActionId(crypto.randomUUID());
    dialogRef.current?.showModal();
  }

  function close() {
    if (!pending) dialogRef.current?.close();
  }

  function review(event: React.FormEvent) {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!amountCents || amountCents <= 0) return setError("Enter a refund amount greater than $0.");
    if (amountCents > refundableCents) return setError("The refund cannot exceed the remaining refundable amount.");
    if (!trimmedReason) return setError("Enter a refund reason.");
    if (trimmedReason.length > 500) return setError("Refund reason must be 500 characters or fewer.");
    setReason(trimmedReason);
    setError(null);
    setStep("confirm");
  }

  async function submit() {
    if (!amountCents) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/manage/restaurants/${encodeURIComponent(slug)}/orders/${orderId}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, reason, clientActionId }),
      });
      const payload: unknown = await response.json();
      if (response.status === 401 || response.status === 403) {
        window.dispatchEvent(new Event("menu-man-management-access-lost"));
        return;
      }
      if (!response.ok) {
        throw new Error(typeof payload === "object" && payload && "error" in payload
          ? String(payload.error)
          : "Refund could not be submitted.");
      }
      const result = managedRefundResultSchema.parse(payload);
      dialogRef.current?.close();
      setNotice(result.status === "succeeded"
        ? "Refund confirmed by the payment provider."
        : result.status === "failed"
          ? "The payment provider declined the refund."
          : result.status === "unknown"
            ? "The provider outcome is unknown and requires review."
            : "Refund submitted to the payment provider.");
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(`menu-man-orders:${restaurantId}`);
        channel.postMessage({ orderId });
        channel.close();
      }
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Refund could not be submitted.");
    } finally {
      setPending(false);
    }
  }

  const unavailableReason = !policyEligible
    ? "This order is outside the restaurant refund window."
    : !providerAvailable
      ? "The payment provider is not currently able to accept refunds."
      : refundableCents <= 0
        ? "No refundable balance remains."
        : null;

  return (
    <div className={styles.refundAction}>
      {notice ? <p className={styles.success}>{notice}</p> : null}
      <details className={styles.actionsMenu}>
        <summary className={styles.secondaryButton}>Actions <span aria-hidden="true">•••</span></summary>
        <div className={styles.actionsMenuPanel}>
          <button type="button" disabled={!eligible} onClick={open}>Issue refund</button>
          {unavailableReason ? <p>{unavailableReason}</p> : null}
        </div>
      </details>
      <dialog ref={dialogRef} className={styles.refundDialog} aria-labelledby="refund-dialog-title" onCancel={(event) => { if (pending) event.preventDefault(); }}>
        <form onSubmit={review}>
          <div className={styles.dialogHeader}>
            <div><p className={styles.eyebrow}>Original payment method</p><h2 id="refund-dialog-title">Issue refund</h2></div>
            <button className={styles.dialogClose} type="button" aria-label="Close refund dialog" onClick={close} disabled={pending}>×</button>
          </div>
          {step === "edit" ? <>
            <dl className={styles.refundFacts}>
              <div><dt>Original order total</dt><dd>{money(originalTotalCents, currency)}</dd></div>
              <div><dt>Already refunded</dt><dd>{money(refundedCents, currency)}</dd></div>
              {pendingRefundCents > 0 ? <div><dt>Pending or unresolved</dt><dd>{money(pendingRefundCents, currency)}</dd></div> : null}
              <div><dt>Refundable now</dt><dd>{money(refundableCents, currency)}</dd></div>
            </dl>
            <fieldset className={styles.refundOptions}>
              <legend>Refund amount</legend>
              <label><input type="radio" name="refund-kind" checked={mode === "full"} onChange={() => setMode("full")} /> Full remaining refund ({money(refundableCents, currency)})</label>
              <label><input type="radio" name="refund-kind" checked={mode === "partial"} onChange={() => setMode("partial")} /> Partial refund</label>
            </fieldset>
            {mode === "partial" ? <label className={styles.refundField}>Amount
              <span className={styles.moneyInput}><span aria-hidden="true">$</span><input inputMode="decimal" autoComplete="off" value={partialAmount} onChange={(event) => setPartialAmount(event.target.value)} placeholder="0.00" aria-describedby="refund-amount-help" required /></span>
              <small id="refund-amount-help">Maximum {money(refundableCents, currency)}</small>
            </label> : null}
            <label className={styles.refundField}>Reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} required />
              <small>{reason.length}/500</small>
            </label>
          </> : <div className={styles.refundConfirmation}>
            <h3>Refund {money(amountCents || 0, currency)} to the customer?</h3>
            <p>This sends funds back to the original payment method.</p>
            <dl><div><dt>Amount</dt><dd>{money(amountCents || 0, currency)}</dd></div><div><dt>Reason</dt><dd>{reason}</dd></div></dl>
          </div>}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.dialogActions}>
            {step === "confirm" ? <button className={styles.secondaryButton} type="button" onClick={() => setStep("edit")} disabled={pending}>Back</button> : <button className={styles.secondaryButton} type="button" onClick={close}>Cancel</button>}
            {step === "edit" ? <button className={styles.button} type="submit">Review refund</button> : <button className={styles.dangerButton} type="button" onClick={() => void submit()} disabled={pending}>{pending ? "Submitting…" : `Confirm ${money(amountCents || 0, currency)} refund`}</button>}
          </div>
        </form>
      </dialog>
    </div>
  );
}
