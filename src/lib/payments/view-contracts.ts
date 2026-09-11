import { z } from "zod";
import { paymentStatusSchema } from "./contracts";

const uuid = z.uuid().transform((value) => value.toLowerCase());

const orderSnapshotItemSchema = z.strictObject({
  orderItemId: uuid,
  menuItemId: uuid,
  itemName: z.string().min(1),
  quantity: z.int().positive(),
  unitPriceCents: z.int().nonnegative(),
  lineTotalCents: z.int().nonnegative(),
  specialInstructions: z.string().nullable(),
  modifiers: z.array(z.strictObject({
    groupName: z.string().min(1),
    optionName: z.string().min(1),
    priceAdjustmentCents: z.int().nonnegative(),
  })),
});

export const orderPaymentViewSchema = z.strictObject({
  order: z.strictObject({
    orderId: uuid,
    orderNumber: z.string().regex(/^\d+$/),
    orderStatus: z.enum(["pending_payment", "placed", "confirmed", "preparing", "ready", "completed", "cancelled"]),
    paymentStatus: z.enum(["unpaid", "pending", "paid", "failed", "partially_refunded", "refunded"]),
    currency: z.string().regex(/^[A-Z]{3}$/),
    subtotalCents: z.int().nonnegative(),
    taxCents: z.int().nonnegative(),
    tipCents: z.int().nonnegative(),
    totalCents: z.int().nonnegative(),
    pickup: z.strictObject({
      mode: z.enum(["asap", "scheduled"]),
      pickupAt: z.string().datetime({ offset: true }),
      timezone: z.string().min(1),
    }),
    items: z.array(orderSnapshotItemSchema),
    replayed: z.boolean(),
    cancellationReason: z.string().nullable(),
  }),
  payment: paymentStatusSchema,
});

export type OrderPaymentView = z.output<typeof orderPaymentViewSchema>;
