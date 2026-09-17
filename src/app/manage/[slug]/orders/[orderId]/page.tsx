import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getManagedOrderDetail, listRestaurantMemberships, ManagementError } from "@/lib/order-management/server";
import { formatQueuePaymentLabel } from "@/lib/order-management/contracts";
import FulfillmentAction from "./FulfillmentAction";
import sharedStyles from "../../../management.module.css";
import styles from "../orders.module.css";
import ManagementNav from "../../ManagementNav";
import OrderDetailAccessGuard from "./OrderDetailAccessGuard";
import RefundAction from "./RefundAction";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function dateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

export default async function ManagedOrderDetailPage({ params }: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await params;
  let memberships;
  try { memberships = await listRestaurantMemberships(); }
  catch (error) {
    if (error instanceof ManagementError && error.code === "UNAUTHENTICATED") redirect(`/manage/login?next=${encodeURIComponent(`/manage/${slug}/orders/${orderId}`)}`);
    throw error;
  }
  const membership = memberships.find((entry) => entry.restaurantSlug === slug);
  if (!membership?.capabilities.includes("view_orders")) redirect("/manage");
  let order;
  try { order = await getManagedOrderDetail(slug, orderId); }
  catch (error) { if (error instanceof ManagementError && error.code === "NOT_FOUND") notFound(); throw error; }

  return (
    <main className={sharedStyles.main}>
      <OrderDetailAccessGuard slug={slug} orderId={orderId} restaurantId={membership.restaurantId} restaurantName={membership.restaurantName}>
      <div className={styles.page}>
        <ManagementNav slug={slug} active="orders" capabilities={membership.capabilities} />
        <Link className={styles.backLink} href={`/manage/${slug}/orders`}>← Back to orders</Link>
        <header className={styles.pageHeader}>
          <div><p className={styles.eyebrow}>{membership.restaurantName}</p><h1 className={styles.title}>Order #{order.orderNumber}</h1><p className={styles.pickupHero}>{order.pickup.mode === "asap" ? "ASAP pickup" : "Pickup"} · {dateTime(order.pickup.pickupAt, order.pickup.timezone)}</p></div>
          <div className={styles.detailActions}>
            <div className={styles.headerActions}><span className={styles.identity}>{membership.displayName}</span><span className={styles.role}>{membership.memberRole}</span><form action="/auth/sign-out" method="post"><button className={styles.secondaryButton}>Sign out</button></form></div>
            {membership.capabilities.includes("advance_fulfillment") ? <FulfillmentAction key={`${order.fulfillment.status}:${order.fulfillment.version}`} slug={slug} orderId={order.orderId} status={order.fulfillment.status} version={order.fulfillment.version} /> : null}
            {membership.capabilities.includes("issue_refunds") ? <RefundAction slug={slug} restaurantId={membership.restaurantId} orderId={order.orderId} originalTotalCents={order.totalCents} refundedCents={order.payment.refundedCents} refundableCents={order.payment.refundableCents} pendingRefundCents={order.payment.pendingRefundCents} currency={order.currency} policyEligible={order.payment.refundPolicyEligible} providerAvailable={order.payment.refundProviderAvailable} /> : null}
            <div className={styles.exceptionActionSlot} data-exception-actions-slot="reserved" aria-hidden="true" />
          </div>
        </header>
        <div className={styles.detailGrid}>
          <div>
            <section className={styles.panel}><h2 className={styles.panelTitle}>Ordered items</h2>{order.items.map((item) => <article className={styles.item} key={item.orderItemId}><strong>{item.quantity}×</strong><div><p className={styles.itemName}>{item.itemName}</p>{item.modifiers.map((modifier, index) => <p className={styles.modifier} key={`${modifier.groupName}-${modifier.optionName}-${index}`}>{modifier.groupName}: {modifier.optionName}{modifier.priceAdjustmentCents ? ` (+${money(modifier.priceAdjustmentCents, order.currency)})` : ""}</p>)}{item.specialInstructions ? <p className={styles.instruction}>Item note: {item.specialInstructions}</p> : null}</div><strong>{money(item.lineTotalCents, order.currency)}</strong></article>)}{order.orderNotes ? <p className={styles.instruction}><strong>Order note:</strong> {order.orderNotes}</p> : null}</section>
            <section className={styles.panel}><h2 className={styles.panelTitle}>Operational timeline</h2><ol className={styles.timeline}>{order.timeline.map((event) => <li className={styles.timelineItem} key={event.id}><strong>{event.label}</strong><p className={styles.timelineMeta}>{event.actorName ? `${event.actorName} · ` : ""}{dateTime(event.occurredAt, order.pickup.timezone)}</p></li>)}</ol></section>
          </div>
          <aside>
            <section className={styles.panel}><h2 className={styles.panelTitle}>Status</h2><p><strong>Fulfillment:</strong> {order.fulfillment.status}</p><p className={styles.paid} style={{ marginTop: 8 }}>{formatQueuePaymentLabel(order.payment.status, order.payment.refundedCents, order.currency)}</p>{order.payment.refundedCents > 0 ? <p className={styles.meta} style={{ marginTop: 8 }}>Total refunded: {money(order.payment.refundedCents, order.currency)}</p> : null}<p className={styles.meta} style={{ marginTop: 4 }}>Refundable now: {money(order.payment.refundableCents, order.currency)}</p></section>
            {order.payment.refunds.length ? <section className={styles.panel}><h2 className={styles.panelTitle}>Refund history</h2><ol className={styles.refundHistory}>{order.payment.refunds.map((refund) => <li key={refund.refundId}><div><strong>{money(refund.amountCents, order.currency)}</strong><span className={styles.refundStatus}>{refund.status === "unknown" ? "requires review" : refund.status}</span></div><p>{refund.reason}</p><p className={styles.timelineMeta}>Requested {dateTime(refund.requestedAt, order.pickup.timezone)}{refund.requestedBy ? ` by ${refund.requestedBy}` : ""}{refund.completedAt ? ` · Completed ${dateTime(refund.completedAt, order.pickup.timezone)}` : ""}</p></li>)}</ol></section> : null}
            <section className={styles.panel}><h2 className={styles.panelTitle}>Customer</h2>{order.customer ? <div className={styles.contact}><strong>{order.customer.name}</strong>{order.customer.phone ? <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a> : null}{order.customer.email ? <a href={`mailto:${order.customer.email}`}>{order.customer.email}</a> : null}</div> : <p className={styles.meta}>Customer contact access is restricted.</p>}</section>
            <section className={styles.panel}><h2 className={styles.panelTitle}>Receipt</h2><div className={styles.receipt}><div className={styles.receiptRow}><span>Subtotal</span><span>{money(order.subtotalCents, order.currency)}</span></div><div className={styles.receiptRow}><span>Tax</span><span>{money(order.taxCents, order.currency)}</span></div><div className={styles.receiptRow}><span>Tip</span><span>{money(order.tipCents, order.currency)}</span></div><div className={`${styles.receiptRow} ${styles.receiptTotal}`}><span>Total</span><span>{money(order.totalCents, order.currency)}</span></div></div></section>
          </aside>
        </div>
      </div>
      </OrderDetailAccessGuard>
    </main>
  );
}
