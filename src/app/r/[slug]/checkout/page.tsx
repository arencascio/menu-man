import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getOrderPaymentView, getPaymentStatus, PaymentServerError } from "@/lib/payments/server";
import { listGuestPaymentCapabilities } from "@/lib/payments/capability-cookie";
import { paymentLocksCart } from "@/lib/payments/state";
import CheckoutPanel from "../CheckoutPanel";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: restaurant } = await supabaseServer
    .from("restaurants")
    .select("id, slug, currency")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!restaurant) notFound();

  for (const capability of await listGuestPaymentCapabilities()) {
    try {
      const view = await getOrderPaymentView(slug, capability.orderId, capability.checkoutToken);
      const payment = await getPaymentStatus(capability.orderId, capability.checkoutToken);
      if (paymentLocksCart(payment)) {
        redirect(`/r/${encodeURIComponent(slug)}/order/${view.order.orderId}/payment`);
      }
    } catch (error) {
      if (!(error instanceof PaymentServerError)) throw error;
    }
  }

  const { data: menu } = await supabaseServer
    .from("menus")
    .select("id")
    .eq("restaurant_id", restaurant.id)
    .eq("is_published", true)
    .maybeSingle();
  if (!menu) notFound();

  const { data: orderingSettings } = await supabaseServer
    .from("restaurant_ordering_settings")
    .select("customer_name_required, customer_email_required, customer_phone_required")
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  return (
    <CheckoutPanel
      restaurantId={restaurant.id}
      restaurantSlug={restaurant.slug}
      menuId={menu.id}
      currency={restaurant.currency || "USD"}
      customerRequirements={{
        customerNameRequired: orderingSettings?.customer_name_required ?? true,
        customerEmailRequired: orderingSettings?.customer_email_required ?? true,
        customerPhoneRequired: orderingSettings?.customer_phone_required ?? true,
      }}
    />
  );
}
