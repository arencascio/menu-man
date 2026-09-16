import { notFound, redirect } from "next/navigation";
import { getGuestPaymentCapability } from "@/lib/payments/capability-cookie";
import { getOrderPaymentView, getPaymentSession, PaymentServerError } from "@/lib/payments/server";
import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import PaymentPanel from "../../../PaymentPanel";
import OrderSnapshot from "../../../OrderSnapshot";
import styles from "../../../menu-browser.module.css";

export const dynamic = "force-dynamic";

function formatStatus(status: string) {
  const words = status.replaceAll("_", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; orderId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug, orderId } = await params;
  const detailsRequested = (await searchParams).view === "details";
  const checkoutToken = await getGuestPaymentCapability(orderId);
  if (!checkoutToken) redirect(`/r/${encodeURIComponent(slug)}`);
  let view;
  try {
    view = await getOrderPaymentView(slug, orderId, checkoutToken);
  } catch (error) {
    if (error instanceof PaymentServerError) redirect(`/r/${encodeURIComponent(slug)}`);
    throw error;
  }
  const viewIsPlaced = view.payment.orderStatus === "placed"
    && ["paid", "partially_refunded", "refunded"].includes(view.payment.paymentStatus);
  if (detailsRequested) {
    const returnHref = viewIsPlaced
      ? `/r/${encodeURIComponent(slug)}/order/${encodeURIComponent(orderId)}/confirmation`
      : `/r/${encodeURIComponent(slug)}/order/${encodeURIComponent(orderId)}/payment`;
    return (
      <main className={styles.page}>
        <section className={styles.checkoutPanel} aria-labelledby="order-details-title">
          <p className={styles.expandedLabel}>Order details</p>
          <h1 id="order-details-title">Order #{view.order.orderNumber}</h1>
          <dl className={styles.confirmationStatus}>
            <div><dt>Order status</dt><dd>{formatStatus(view.payment.orderStatus)}</dd></div>
            <div><dt>Payment status</dt><dd>{formatStatus(view.payment.paymentStatus)}</dd></div>
          </dl>
          <OrderSnapshot order={view.order} />
          <nav aria-label="Order detail actions">
            <Link className={styles.checkoutButton} href={returnHref}>{viewIsPlaced ? "Return to Confirmation" : "Return to Payment"}</Link>
          </nav>
        </section>
      </main>
    );
  }

  let session;
  try {
    session = await getPaymentSession(orderId, checkoutToken);
  } catch (error) {
    if (error instanceof PaymentServerError) redirect(`/r/${encodeURIComponent(slug)}`);
    throw error;
  }
  const currentView = { ...view, payment: session.payment };
  const isPlaced = currentView.payment.orderStatus === "placed"
    && ["paid", "partially_refunded", "refunded"].includes(currentView.payment.paymentStatus);
  if (isPlaced) {
    redirect(`/r/${encodeURIComponent(slug)}/order/${encodeURIComponent(orderId)}/confirmation`);
  }
  const { data: restaurant } = await supabaseServer.from("restaurants").select("id").eq("slug", slug).maybeSingle();
  if (!restaurant) notFound();
  return <PaymentPanel restaurantId={restaurant.id} restaurantSlug={slug} initialView={currentView} paymentSession={session} />;
}
