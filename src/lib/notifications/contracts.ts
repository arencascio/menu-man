import { z } from "zod";

export const notificationSettingsSchema = z.object({
  customerOrderConfirmationEmail: z.boolean(),
  customerReadyForPickupEmail: z.boolean(),
  customerRefundConfirmationEmail: z.boolean(),
  internalNewPaidOrderEmail: z.boolean(),
  internalPaymentRefundExceptionEmail: z.boolean(),
  internalEmailRecipient: z.union([z.email(), z.null()]),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const updateNotificationSettingsRequestSchema = notificationSettingsSchema
  .omit({ updatedAt: true })
  .extend({ clientActionId: z.uuid() })
  .refine((settings) => !(
    settings.internalNewPaidOrderEmail || settings.internalPaymentRefundExceptionEmail
  ) || Boolean(settings.internalEmailRecipient), {
    message: "Enter an internal recipient before enabling restaurant emails.",
    path: ["internalEmailRecipient"],
  });

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export const claimedNotificationSchema = z.object({
  outboxId: z.uuid(),
  claimToken: z.uuid(),
  attemptNumber: z.number().int().positive(),
  notificationType: z.enum([
    "customer.order_confirmed",
    "customer.ready_for_pickup",
    "customer.refund_confirmed",
    "internal.new_paid_order",
    "internal.payment_refund_exception",
  ]),
  recipient: z.email(),
  idempotencyKey: z.string().min(1).max(256),
  restaurantName: z.string().min(1),
  orderNumber: z.string().min(1),
  pickupMode: z.enum(["asap", "scheduled"]),
  pickupAt: z.iso.datetime({ offset: true }),
  pickupTimezone: z.string().min(1),
  restaurantAddressLine1: z.string().nullable(),
  restaurantCity: z.string().nullable(),
  restaurantState: z.string().nullable(),
  restaurantPostalCode: z.string().nullable(),
  googleMapsUrl: z.string().nullable(),
  customerEmail: z.email().nullable(),
});

export type ClaimedNotification = z.infer<typeof claimedNotificationSchema>;
