import type { AuthoritativeOrderResponse, CheckoutResponse } from "./contracts";
import type { PaymentSessionResponse } from "@/lib/payments/contracts";

export function isCheckoutPayable(
  order: AuthoritativeOrderResponse,
): order is AuthoritativeOrderResponse & { orderStatus: "pending_payment"; paymentStatus: "unpaid" } {
  return order.orderStatus === "pending_payment" && order.paymentStatus === "unpaid";
}

export function existingCheckoutResponse(
  order: AuthoritativeOrderResponse,
  hasGuestCapability: boolean,
): Extract<CheckoutResponse, { kind: "existing" }> {
  if (!order.replayed || isCheckoutPayable(order)) {
    throw new Error("Only a progressed exact replay can use the existing-order response.");
  }
  return {
    kind: "existing",
    replayed: true,
    orderId: hasGuestCapability ? order.orderId : null,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
  };
}

type PreparedPayment = PaymentSessionResponse & { checkoutToken: string };

export async function resolveCheckoutResponse(
  order: AuthoritativeOrderResponse,
  operations: {
    canViewExistingOrder: (orderId: string) => Promise<boolean>;
    preparePayment: (orderId: string) => Promise<PreparedPayment | null>;
  },
): Promise<{
  response: CheckoutResponse;
  capability: { orderId: string; checkoutToken: string; expiresAt: string } | null;
}> {
  if (!isCheckoutPayable(order)) {
    return {
      response: existingCheckoutResponse(order, await operations.canViewExistingOrder(order.orderId)),
      capability: null,
    };
  }
  const paymentSession = await operations.preparePayment(order.orderId);
  if (!paymentSession) {
    return { response: { kind: "payable", ...order, paymentSession: null }, capability: null };
  }
  const { checkoutToken, ...publicSession } = paymentSession;
  return {
    response: { kind: "payable", ...order, paymentSession: publicSession },
    capability: { orderId: order.orderId, checkoutToken, expiresAt: paymentSession.expiresAt },
  };
}

export function existingCheckoutMessage(order: Extract<CheckoutResponse, { kind: "existing" }>) {
  if (order.paymentStatus === "refunded" || order.paymentStatus === "partially_refunded") {
    return "This order's payment has been refunded or partially refunded. It cannot be paid again.";
  }
  if (order.orderStatus === "cancelled") {
    return "This checkout is closed and cannot be paid again. Start a new order if needed.";
  }
  if (order.paymentStatus === "paid") {
    return "This order has already been paid. Its current details are available from the original order session.";
  }
  return "This checkout already exists. Open the original order session to view its current status.";
}

export function existingCheckoutDetailsPath(
  restaurantSlug: string,
  order: Extract<CheckoutResponse, { kind: "existing" }>,
) {
  return order.orderId
    ? `/r/${encodeURIComponent(restaurantSlug)}/order/${encodeURIComponent(order.orderId)}/payment?view=details`
    : null;
}
