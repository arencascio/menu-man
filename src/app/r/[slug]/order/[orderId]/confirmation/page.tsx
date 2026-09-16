import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getGuestPaymentCapability } from "@/lib/payments/capability-cookie";
import { getOrderPaymentView, PaymentServerError } from "@/lib/payments/server";
import OrderSnapshot from "../../../OrderSnapshot";
import ConfirmationEffects from "../../../ConfirmationEffects";
import styles from "../../../menu-browser.module.css";
import { supabaseServer } from "@/lib/supabase/server";
import CustomerEmailLine from "./CustomerEmailLine";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ params }: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await params;
  const checkoutToken = await getGuestPaymentCapability(orderId);
  if (!checkoutToken) redirect(`/r/${encodeURIComponent(slug)}`);
  let view;
  try {
    view = await getOrderPaymentView(slug, orderId, checkoutToken);
  } catch (error) {
    if (error instanceof PaymentServerError) notFound();
    throw error;
  }
  if (!(view.payment.orderStatus === "placed" && ["paid", "partially_refunded", "refunded"].includes(view.payment.paymentStatus))) {
    redirect(`/r/${encodeURIComponent(slug)}/order/${encodeURIComponent(orderId)}/payment`);
  }
  const { data: restaurant } = await supabaseServer.from("restaurants").select("id").eq("slug", slug).maybeSingle();
  if (!restaurant) notFound();
  return (
    <main className={styles.page}>
      <ConfirmationEffects restaurantId={restaurant.id} orderId={orderId} currency={view.order.currency} />
      <section className={`${styles.checkoutPanel} ${styles.confirmationPanel}`} aria-labelledby="confirmation-title">
        <header className={styles.confirmationHeader}>
          <span className={styles.successMark} aria-hidden="true">✓</span>
          <p className={styles.expandedLabel}>Order placed</p>
          <h1 id="confirmation-title">Order #{view.order.orderNumber}</h1>
          <p>Your payment is confirmed and the restaurant has received your pickup order.</p>
          <CustomerEmailLine email={view.order.customerEmail} />
        </header>
        <dl className={styles.confirmationStatus}>
          <div><dt>Pickup status</dt><dd>Order placed</dd></div>
          <div><dt>Order number</dt><dd>#{view.order.orderNumber}</dd></div>
        </dl>
        <section aria-label="Order details">
          <OrderSnapshot order={view.order} />
        </section>
        {/* Future confirmation sections:
            - restaurant address and directions
            - confirmation email delivery notice
            - printable/PDF receipt
            - optional daily-reset display numbers; the restaurant and diner
              intentionally share the same order number today */}
        <nav aria-label="Confirmation actions">
          <Link className={styles.checkoutButton} href={`/r/${encodeURIComponent(slug)}/order/${encodeURIComponent(orderId)}/payment?view=details`}>Return to Order Details</Link>
          <Link className={styles.secondaryConfirmationButton} href={`/r/${encodeURIComponent(slug)}`}>Return to Menu</Link>
        </nav>
      </section>
    </main>
  );
}
