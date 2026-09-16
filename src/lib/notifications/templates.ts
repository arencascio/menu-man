import type { ClaimedNotification } from "./contracts";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]!);
}

function pickupDateTime(notification: ClaimedNotification) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: notification.pickupTimezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(notification.pickupAt));
}

function pickupMode(notification: ClaimedNotification) {
  return notification.pickupMode === "asap" ? "ASAP pickup" : "Scheduled pickup";
}

function restaurantAddress(notification: ClaimedNotification) {
  const locality = [notification.restaurantCity, notification.restaurantState]
    .filter(Boolean).join(", ");
  const localityWithPostalCode = [locality, notification.restaurantPostalCode]
    .filter(Boolean).join(" ");
  return [notification.restaurantAddressLine1, localityWithPostalCode]
    .filter(Boolean).join(", ") || null;
}

function safeDirectionsUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function detailRow(label: string, value: string) {
  return `<tr><td style="padding:0 0 6px;color:#6b6259;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">${escapeHtml(label)}</td></tr><tr><td style="padding:0 0 18px;color:#1f1b16;font-size:16px">${escapeHtml(value)}</td></tr>`;
}

export function renderNotificationEmail(notification: ClaimedNotification) {
  const copy = {
    "customer.order_confirmed": {
      subject: `Order #${notification.orderNumber} confirmed · ${notification.restaurantName}`,
      heading: "Your order is confirmed",
      status: `${notification.restaurantName} has received your pickup order.`,
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
      status: "Review this order in Menu Man Order Management.",
    },
  }[notification.notificationType];

  const isPolishedCustomerTemplate = [
    "customer.order_confirmed",
    "customer.ready_for_pickup",
  ].includes(notification.notificationType);
  const address = restaurantAddress(notification);
  const directionsUrl = safeDirectionsUrl(notification.googleMapsUrl);
  const details = [
    ["Restaurant", notification.restaurantName],
    ["Order", `#${notification.orderNumber}`],
    ["Pickup mode", pickupMode(notification)],
    ["Pickup date & time", pickupDateTime(notification)],
    ...(address ? [["Pickup address", address]] : []),
    ...(isPolishedCustomerTemplate && notification.customerEmail
      ? [["Email on order", notification.customerEmail]]
      : []),
  ] as Array<[string, string]>;
  const textDetails = details.map(([label, value]) => `${label}: ${value}`).join("\n");
  const directionsText = isPolishedCustomerTemplate && directionsUrl
    ? `\nDirections: ${directionsUrl}`
    : "";
  const directionsHtml = isPolishedCustomerTemplate && directionsUrl
    ? `<p style="margin:2px 0 0"><a href="${escapeHtml(directionsUrl)}" style="color:#9a3f19;font-weight:700">Get directions</a></p>`
    : "";

  return {
    subject: copy.subject,
    text: `MENU MAN\n\n${copy.heading}\n\n${copy.status}\n\n${textDetails}${directionsText}\n\nMenu Man`,
    html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f2ed;color:#1f1b16"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f2ed"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e2ddd5;border-radius:12px"><tr><td style="padding:28px 28px 10px;font-family:Arial,sans-serif"><p style="margin:0 0 20px;color:#9a3f19;font-size:13px;font-weight:800;letter-spacing:.12em">MENU MAN</p><h1 style="margin:0 0 12px;font-size:26px;line-height:1.2">${escapeHtml(copy.heading)}</h1><p style="margin:0;color:#4f4841;font-size:16px;line-height:1.55">${escapeHtml(copy.status)}</p></td></tr><tr><td style="padding:18px 28px 10px;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${details.map(([label, value]) => detailRow(label, value)).join("")}</table>${directionsHtml}</td></tr><tr><td style="padding:18px 28px 28px;font-family:Arial,sans-serif;color:#746b62;font-size:12px;border-top:1px solid #eee8e1">Sent by Menu Man for ${escapeHtml(notification.restaurantName)}.</td></tr></table></td></tr></table></body></html>`,
  };
}
