"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fulfillmentTransitionResultSchema, nextFulfillmentStatus, type FulfillmentStatus } from "@/lib/order-management/contracts";
import styles from "../orders.module.css";

const labels = { preparing: "Start preparing", ready: "Mark ready", completed: "Complete order" } as const;

export default function FulfillmentAction({ slug, orderId, status, version }: { slug: string; orderId: string; status: FulfillmentStatus; version: number }) {
  const router = useRouter();
  const [current, setCurrent] = useState({ status, version });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = nextFulfillmentStatus(current.status);
  if (!next) return null;

  async function advance() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/manage/restaurants/${encodeURIComponent(slug)}/orders/${orderId}/fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: current.version, nextStatus: next, clientActionId: crypto.randomUUID() }),
      });
      const payload: unknown = await response.json();
      if (response.status === 403) {
        window.dispatchEvent(new Event("menu-man-management-access-lost"));
        return;
      }
      if (!response.ok) throw new Error(typeof payload === "object" && payload && "error" in payload ? String(payload.error) : "Fulfillment could not be updated.");
      const result = fulfillmentTransitionResultSchema.parse(payload);
      setCurrent({ status: result.status, version: result.version });
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Fulfillment could not be updated.");
    } finally { setPending(false); }
  }

  return <>{error ? <p className={styles.error}>{error}</p> : null}<button className={styles.button} disabled={pending} onClick={() => void advance()}>{pending ? "Updating…" : labels[next]}</button></>;
}
