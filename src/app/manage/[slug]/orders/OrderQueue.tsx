"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdminBrowserClient } from "@/lib/supabase/admin-browser";
import { formatQueuePaymentLabel, managedOrderPageSchema, nextFulfillmentStatus, timingState, type ManagedOrderPage, type ManagedOrderSummary, type OrderListView } from "@/lib/order-management/contracts";
import AccessRevoked from "../AccessRevoked";
import styles from "./orders.module.css";

type HistoryPreset = "today" | "7" | "30" | "90" | "custom";

function localDateInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dateRange(preset: HistoryPreset, timezone: string, customFrom: string, customTo: string) {
  if (preset === "custom") return { from: customFrom, to: customTo };
  const today = localDateInZone(new Date(), timezone);
  const [year, month, day] = today.split("-").map(Number);
  const span = preset === "today" ? 1 : Number(preset);
  const from = new Date(Date.UTC(year, month - 1, day - span + 1));
  return { from: from.toISOString().slice(0, 10), to: today };
}

function pickupLabel(order: ManagedOrderSummary) {
  return new Intl.DateTimeFormat("en-US", { timeZone: order.pickupTimezone, hour: "numeric", minute: "2-digit" }).format(new Date(order.pickupAt));
}

function historyPickupLabel(order: ManagedOrderSummary) {
  return new Intl.DateTimeFormat("en-US", { timeZone: order.pickupTimezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(order.pickupAt));
}

export default function OrderQueue({ slug, restaurantId, restaurantName, timezone, canAdvance, canExport, initialPage }: { slug: string; restaurantId: string; restaurantName: string; timezone: string; canAdvance: boolean; canExport: boolean; initialPage: ManagedOrderPage }) {
  const [view, setView] = useState<OrderListView>("active");
  const [page, setPage] = useState(initialPage);
  const [preset, setPreset] = useState<HistoryPreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [dateBasis, setDateBasis] = useState<"placed" | "pickup">("placed");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [accessLost, setAccessLost] = useState<"revoked" | "signed-out" | null>(null);

  const buildUrl = useCallback((targetView: OrderListView, cursor?: ManagedOrderPage["nextCursor"]) => {
    const params = new URLSearchParams({ view: targetView, dateBasis, limit: "50" });
    if (targetView === "history") {
      const range = dateRange(preset, timezone, customFrom, customTo);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
    }
    if (cursor) {
      params.set("cursorAt", cursor.at);
      params.set("cursorOrderId", cursor.orderId);
    }
    return `/api/manage/restaurants/${encodeURIComponent(slug)}/orders?${params}`;
  }, [customFrom, customTo, dateBasis, preset, slug, timezone]);

  const refresh = useCallback(async (targetView: OrderListView, cursor: ManagedOrderPage["nextCursor"] = null) => {
    if (accessLost) return;
    if (targetView === "history" && preset === "custom" && (!customFrom || !customTo)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildUrl(targetView, cursor), { cache: "no-store" });
      if (response.status === 403 || response.status === 401) {
        setPage({ orders: [], nextCursor: null });
        setAccessLost(response.status === 403 ? "revoked" : "signed-out");
        return;
      }
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(typeof payload === "object" && payload && "error" in payload ? String(payload.error) : "Orders could not be loaded.");
      const next = managedOrderPageSchema.parse(payload);
      setPage((current) => cursor ? { orders: [...current.orders, ...next.orders], nextCursor: next.nextCursor } : next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Orders could not be loaded.");
    } finally { setLoading(false); }
  }, [accessLost, buildUrl, customFrom, customTo, preset]);

  useEffect(() => {
    if (accessLost) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [accessLost]);

  useEffect(() => {
    if (accessLost) return;
    const poll = window.setInterval(() => { void refresh(view); }, 15_000);
    const focus = () => { void refresh(view); };
    window.addEventListener("focus", focus);
    return () => { window.clearInterval(poll); window.removeEventListener("focus", focus); };
  }, [accessLost, refresh, view]);

  useEffect(() => {
    if (accessLost) return;
    const supabase = createAdminBrowserClient();
    const channel = supabase.channel(`restaurant:${restaurantId}:orders`, { config: { private: true } })
      .on("broadcast", { event: "order_changed" }, () => { void refresh(view); })
      .subscribe();
    const browserChannel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`menu-man-orders:${restaurantId}`);
    if (browserChannel) browserChannel.onmessage = () => { void refresh(view); };
    return () => { void supabase.removeChannel(channel); browserChannel?.close(); };
  }, [accessLost, refresh, restaurantId, view]);

  async function advance(order: ManagedOrderSummary) {
    const nextStatus = nextFulfillmentStatus(order.fulfillmentStatus);
    if (!nextStatus) return;
    setPendingId(order.orderId);
    setError(null);
    try {
      const response = await fetch(`/api/manage/restaurants/${encodeURIComponent(slug)}/orders/${order.orderId}/fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: order.fulfillmentVersion, nextStatus, clientActionId: crypto.randomUUID() }),
      });
      const payload: unknown = await response.json();
      if (response.status === 403 || response.status === 401) {
        setPage({ orders: [], nextCursor: null });
        setAccessLost(response.status === 403 ? "revoked" : "signed-out");
        return;
      }
      if (!response.ok) throw new Error(typeof payload === "object" && payload && "error" in payload ? String(payload.error) : "Fulfillment could not be updated.");
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(`menu-man-orders:${restaurantId}`);
        channel.postMessage({ orderId: order.orderId });
        channel.close();
      }
      await refresh(view);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Fulfillment could not be updated.");
    } finally { setPendingId(null); }
  }

  function changeView(nextView: OrderListView) {
    setView(nextView);
    if (nextView === "active") {
      setPage(initialPage);
      void refresh("active");
    } else void refresh("history");
  }

  const columns = useMemo(() => (["new", "preparing", "ready"] as const).map((status) => ({ status, orders: page.orders.filter((order) => order.fulfillmentStatus === status) })), [page.orders]);
  const actionLabels = { preparing: "Start preparing", ready: "Mark ready", completed: "Complete order" } as const;
  const selectedRange = dateRange(preset, timezone, customFrom, customTo);
  const canDownload = canExport && Boolean(selectedRange.from && selectedRange.to);
  const exportUrl = canDownload
    ? `/api/manage/restaurants/${encodeURIComponent(slug)}/orders/export?${new URLSearchParams({ from: selectedRange.from, to: selectedRange.to, dateBasis }).toString()}`
    : null;

  if (accessLost) return <AccessRevoked restaurantName={restaurantName} slug={slug} signedOut={accessLost === "signed-out"} />;

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.tabs} aria-label="Order view">
          <button className={`${styles.tab} ${view === "active" ? styles.tabActive : ""}`} onClick={() => changeView("active")}>Active queue</button>
          <button className={`${styles.tab} ${view === "history" ? styles.tabActive : ""}`} onClick={() => changeView("history")}>Completed / history</button>
        </div>
        <span className={styles.statusLine}>{loading ? "Refreshing…" : "Live · refreshes automatically"}</span>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {view === "active" ? (
        <div className={styles.columns}>
          {columns.map((column) => <section className={styles.column} key={column.status}>
            <header className={styles.columnHeader}><span>{column.status}</span><span className={styles.count}>{column.orders.length}</span></header>
            <div className={styles.cardList}>
              {column.orders.length === 0 ? <p className={styles.emptyColumn}>No orders</p> : column.orders.map((order) => {
                const timing = timingState(order.pickupAt, now);
                const nextStatus = nextFulfillmentStatus(order.fulfillmentStatus);
                return <article className={styles.card} key={order.orderId}>
                  <div className={styles.cardTop}><Link className={styles.orderLink} href={`/manage/${slug}/orders/${order.orderId}`}>#{order.orderNumber}</Link><span className={styles.pickupTime}>{order.pickupMode === "asap" ? "ASAP · " : ""}{pickupLabel(order)}</span></div>
                  <span className={`${styles.timing} ${timing.tone === "late" ? styles.timingLate : timing.tone === "due" ? styles.timingDue : ""}`}>{timing.label}</span>
                  <p className={styles.customer}>{order.customerName ?? "Customer contact restricted"}</p>
                  <p className={styles.items}>{order.itemSummary.map((item) => `${item.quantity}× ${item.itemName}`).join(" · ")}</p>
                  <div className={styles.cardFacts}><span>{order.itemCount} {order.itemCount === 1 ? "item" : "items"}</span><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency }).format(order.totalCents / 100)}</strong></div>
                  <footer className={styles.cardFooter}><span className={styles.paid}>{formatQueuePaymentLabel(order.paymentStatus, order.refundedCents, order.currency)}</span>{canAdvance && nextStatus ? <button className={styles.advanceButton} disabled={pendingId === order.orderId} onClick={() => void advance(order)}>{actionLabels[nextStatus]}</button> : null}</footer>
                </article>;
              })}
            </div>
          </section>)}
        </div>
      ) : (
        <>
          <div className={styles.filters}>
            <label className={styles.filterLabel}>Date range<select className={styles.select} value={preset} onChange={(event) => setPreset(event.target.value as HistoryPreset)}><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom</option></select></label>
            {preset === "custom" ? <><label className={styles.filterLabel}>From<input className={styles.dateInput} type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label><label className={styles.filterLabel}>To<input className={styles.dateInput} type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label></> : null}
            <label className={styles.filterLabel}>Date basis<select className={styles.select} value={dateBasis} onChange={(event) => setDateBasis(event.target.value as "placed" | "pickup")}><option value="placed">Order placed</option><option value="pickup">Pickup date</option></select></label>
            <button className={styles.secondaryButton} onClick={() => void refresh("history")}>Apply</button>
            {exportUrl ? <a className={styles.secondaryButton} href={exportUrl}>Download CSV</a> : canExport ? <span className={styles.disabledButton} aria-disabled="true">Download CSV</span> : null}
          </div>
          <div className={styles.history} style={{ marginTop: 14 }}>
            <div className={`${styles.historyRow} ${styles.historyHeader}`}><span>Order</span><span>Customer / items</span><span>Placed</span><span>Pickup</span><span>Payment</span><span>Total</span></div>
            {page.orders.length === 0 ? <p className={styles.emptyColumn}>No completed orders in this range.</p> : page.orders.map((order) => <div className={styles.historyRow} key={order.orderId}><Link className={styles.orderLink} href={`/manage/${slug}/orders/${order.orderId}`}>#{order.orderNumber}</Link><span><strong>{order.customerName ?? "Contact restricted"}</strong><br /><small>{order.itemCount} {order.itemCount === 1 ? "item" : "items"} · {order.itemSummary.map((item) => `${item.quantity}× ${item.itemName}`).join(", ")}</small></span><span>{historyPickupLabel({ ...order, pickupAt: order.placedAt })}</span><span>{historyPickupLabel(order)}</span><span className={styles.paid}>{formatQueuePaymentLabel(order.paymentStatus, order.refundedCents, order.currency)}</span><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency }).format(order.totalCents / 100)}</strong></div>)}
          </div>
          {page.nextCursor ? <div className={styles.loadMore}><button className={styles.secondaryButton} disabled={loading} onClick={() => void refresh("history", page.nextCursor)}>Load more</button></div> : null}
        </>
      )}
    </>
  );
}
