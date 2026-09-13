import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getGuestPaymentCapability } from "@/lib/payments/capability-cookie";
import { getOrderPaymentView, PaymentServerError } from "@/lib/payments/server";
import OrderSnapshot from "../../../OrderSnapshot";
import ConfirmationEffects from "../../../ConfirmationEffects";
import styles from "../../../menu-browser.module.css";
import { supabaseServer } from "@/lib/supabase/server";

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
      <section className={styles.checkoutPanel} aria-labelledby="confirmation-title">
        <header>
          <p className={styles.expandedLabel}>Order placed</p>
          <h1 id="confirmation-title">Order #{view.order.orderNumber}</h1>
          <p>Payment was verified by the server and the order has been placed with the restaurant.</p>
        </header>
        <section aria-label="Order details">
          <OrderSnapshot order={view.order} />
        </section>
        {/* Future confirmation additions belong in separate pickup, location,
            notification, and receipt sections without changing payment state. */}
        <nav aria-label="Confirmation actions">
          <Link className={styles.checkoutButton} href={`/r/${slug}`}>Return to Menu</Link>
        </nav>
      </section>
    </main>
  );
}
