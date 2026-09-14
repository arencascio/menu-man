"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { nextFulfillmentStatus, type FulfillmentStatus } from "@/lib/order-management/contracts";
import styles from "../orders.module.css";

const labels = { preparing: "Start preparing", ready: "Mark ready", completed: "Complete order" } as const;

export default function FulfillmentAction({ slug, orderId, status, version }: { slug: string; orderId: string; status: FulfillmentStatus; version: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = nextFulfillmentStatus(status);
  if (!next) return null;

  async function advance() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/manage/restaurants/${encodeURIComponent(slug)}/orders/${orderId}/fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: version, nextStatus: next, clientActionId: crypto.randomUUID() }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(typeof payload === "object" && payload && "error" in payload ? String(payload.error) : "Fulfillment could not be updated.");
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Fulfillment could not be updated.");
      setPending(false);
    }
  }

  return <>{error ? <p className={styles.error}>{error}</p> : null}<button className={styles.button} disabled={pending} onClick={() => void advance()}>{pending ? "Updating…" : labels[next]}</button></>;
}
