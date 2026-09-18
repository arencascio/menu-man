import { isValidCustomerEmail, normalizeCustomerEmail } from "./customer-details";

export type CustomerNotificationPreferences = {
  orderConfirmationEnabled: boolean;
  readyForPickupEnabled: boolean;
};

export function checkoutNotificationMessage(
  preferences: CustomerNotificationPreferences,
  email: string | null | undefined,
) {
  const { orderConfirmationEnabled, readyForPickupEnabled } = preferences;
  if (!orderConfirmationEnabled && !readyForPickupEnabled) return null;
  const normalized = normalizeCustomerEmail(email);
  const recipient = normalized && isValidCustomerEmail(normalized) ? normalized : null;
  const updates = orderConfirmationEnabled && readyForPickupEnabled
    ? "order confirmation and ready-for-pickup updates"
    : orderConfirmationEnabled ? "an order confirmation" : "a ready-for-pickup update";
  return recipient
    ? `We'll send ${updates} to ${recipient}.`
    : `Add an email to receive ${updates}.`;
}
