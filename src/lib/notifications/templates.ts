import type { ClaimedNotification } from "./contracts";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]!);
}

function pickupLabel(notification: ClaimedNotification) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: notification.pickupTimezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(notification.pickupAt));
  return `${notification.pickupMode === "asap" ? "ASAP · " : ""}${formatted}`;
}

export function renderNotificationEmail(notification: ClaimedNotification) {
  const restaurantName = escapeHtml(notification.restaurantName);
  const orderNumber = escapeHtml(notification.orderNumber);
  const pickup = escapeHtml(pickupLabel(notification));
  const copy = {
    "customer.order_confirmed": {
      subject: `Order #${notification.orderNumber} confirmed · ${notification.restaurantName}`,
      heading: "Your order is confirmed",
      status: "The restaurant has received your paid pickup order.",
    },
    "customer.ready_for_pickup": {
      subject: `Order #${notification.orderNumber} is ready for pickup`,
      heading: "Your order is ready",
      status: `Your order from ${notification.restaurantName} is ready for pickup.`,
    },
    "customer.refund_confirmed": {
      subject: `Refund confirmed for order #${notification.orderNumber}`,
      heading: "Your refund is confirmed",
      status: `A refund for your order from ${notification.restaurantName} was confirmed.`,
    },
    "internal.new_paid_order": {
      subject: `New paid order #${notification.orderNumber}`,
      heading: "New paid pickup order",
      status: `A new paid order is ready to review for ${notification.restaurantName}.`,
    },
    "internal.payment_refund_exception": {
      subject: `Payment attention needed · order #${notification.orderNumber}`,
      heading: "Payment attention needed",
      status: `Review this order in Menu Man Order Management.`,
    },
  }[notification.notificationType];

  return {
    subject: copy.subject,
    text: `${copy.heading}\n\n${copy.status}\nOrder #${notification.orderNumber}\nPickup: ${pickupLabel(notification)}\n\nMenu Man`,
    html: `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5;max-width:560px"><p style="font-size:13px;font-weight:700">MENU MAN</p><h1 style="font-size:24px">${escapeHtml(copy.heading)}</h1><p>${escapeHtml(copy.status)}</p><dl><dt style="font-size:12px;color:#57534e">RESTAURANT</dt><dd style="margin:0 0 12px">${restaurantName}</dd><dt style="font-size:12px;color:#57534e">ORDER</dt><dd style="margin:0 0 12px">#${orderNumber}</dd><dt style="font-size:12px;color:#57534e">PICKUP</dt><dd style="margin:0">${pickup}</dd></dl></div>`,
  };
}
