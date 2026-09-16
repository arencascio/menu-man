import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { claimedNotificationSchema, type ClaimedNotification } from "./contracts";
import { sendResendEmail, type ResendDeliveryResult } from "./resend";
import { renderNotificationEmail } from "./templates";

function mapClaim(row: Record<string, unknown>): ClaimedNotification {
  return claimedNotificationSchema.parse({
    outboxId: row.outbox_id, claimToken: row.claim_token,
    attemptNumber: row.attempt_number, notificationType: row.notification_type,
    recipient: row.recipient, idempotencyKey: row.idempotency_key,
    restaurantName: row.restaurant_name, orderNumber: row.order_number,
    pickupMode: row.pickup_mode, pickupAt: row.pickup_at,
    pickupTimezone: row.pickup_timezone,
    restaurantAddressLine1: row.restaurant_address_line1,
    restaurantCity: row.restaurant_city,
    restaurantState: row.restaurant_state,
    restaurantPostalCode: row.restaurant_postal_code,
    googleMapsUrl: row.google_maps_url,
    customerEmail: row.customer_email,
  });
}

async function complete(notification: ClaimedNotification, result: ResendDeliveryResult) {
  const { error } = await supabaseServer.rpc("complete_notification_delivery_v1", {
    p_outbox_id: notification.outboxId,
    p_claim_token: notification.claimToken,
    p_succeeded: result.succeeded,
    p_retryable: result.retryable,
    p_http_status: result.httpStatus,
    p_provider_message_id: result.providerMessageId,
    p_error_code: result.errorCode,
    p_error_message: result.errorMessage,
  });
  if (error) throw new Error(`Notification completion failed: ${error.message}`);
}

export async function deliverDueNotifications() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MENU_MAN_ORDER_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Operational email delivery is not configured.");
  const { data, error } = await supabaseServer.rpc("claim_notification_outbox_v1", { p_limit: 5 });
  if (error) throw new Error(`Notification claim failed: ${error.message}`);
  const claims = (data ?? []).map((row: Record<string, unknown>) => mapClaim(row));
  let sent = 0;
  let failed = 0;
  for (const notification of claims) {
    const content = renderNotificationEmail(notification);
    const result = await sendResendEmail(apiKey, {
      from, to: notification.recipient, ...content,
      idempotencyKey: notification.idempotencyKey,
    });
    await complete(notification, result);
    if (result.succeeded) sent += 1;
    else failed += 1;
  }
  return { claimed: claims.length, sent, failed };
}
