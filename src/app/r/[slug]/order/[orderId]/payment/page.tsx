import { notFound, redirect } from "next/navigation";
import { getGuestPaymentCapability } from "@/lib/payments/capability-cookie";
import { getOrderPaymentView, getPaymentSession, PaymentServerError } from "@/lib/payments/server";
import { supabaseServer } from "@/lib/supabase/server";
import PaymentPanel from "../../../PaymentPanel";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await params;
  const checkoutToken = await getGuestPaymentCapability(orderId);
  if (!checkoutToken) redirect(`/r/${encodeURIComponent(slug)}`);
  let view;
  let session;
  try {
    view = await getOrderPaymentView(slug, orderId, checkoutToken);
    session = await getPaymentSession(orderId, checkoutToken);
  } catch (error) {
    if (error instanceof PaymentServerError) redirect(`/r/${encodeURIComponent(slug)}`);
    throw error;
  }
  const currentView = { ...view, payment: session.payment };
  if (currentView.payment.orderStatus === "placed" && ["paid", "partially_refunded", "refunded"].includes(currentView.payment.paymentStatus)) {
    redirect(`/r/${encodeURIComponent(slug)}/order/${encodeURIComponent(orderId)}/confirmation`);
  }
  const { data: restaurant } = await supabaseServer.from("restaurants").select("id").eq("slug", slug).maybeSingle();
  if (!restaurant) notFound();
  return <PaymentPanel restaurantId={restaurant.id} restaurantSlug={slug} initialView={currentView} paymentSession={session} />;
}
