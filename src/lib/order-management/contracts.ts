import { z } from "zod";

export const managementCapabilitySchema = z.enum([
  "view_orders",
  "advance_fulfillment",
  "view_customer_contact",
  "export_order_history",
  "issue_refunds",
  "manage_memberships",
]);

export const managementRoleSchema = z.enum(["owner", "manager", "staff"]);
export const fulfillmentStatusSchema = z.enum(["new", "preparing", "ready", "completed"]);
export const orderListViewSchema = z.enum(["active", "history"]);

export type ManagementCapability = z.infer<typeof managementCapabilitySchema>;
export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>;
export type OrderListView = z.infer<typeof orderListViewSchema>;

export const restaurantMembershipSchema = z.object({
  membershipId: z.uuid(),
  restaurantId: z.uuid(),
  restaurantName: z.string().min(1),
  restaurantSlug: z.string().min(1),
  restaurantTimezone: z.string().min(1),
  memberRole: managementRoleSchema,
  displayName: z.string().min(1),
  capabilities: z.array(managementCapabilitySchema),
});

export type RestaurantMembership = z.infer<typeof restaurantMembershipSchema>;

export const managedOrderSummarySchema = z.object({
  orderId: z.uuid(),
  orderNumber: z.string().min(1),
  placedAt: z.iso.datetime({ offset: true }),
  pickupMode: z.enum(["asap", "scheduled"]),
  pickupAt: z.iso.datetime({ offset: true }),
  pickupTimezone: z.string().min(1),
  customerName: z.string().nullable(),
  itemSummary: z.array(z.object({
    quantity: z.number().int().positive(),
    itemName: z.string().min(1),
  })),
  paymentStatus: z.string().min(1),
  refundedCents: z.number().int().nonnegative(),
  fulfillmentStatus: fulfillmentStatusSchema,
  fulfillmentVersion: z.number().int().positive(),
  statusChangedAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
});

export type ManagedOrderSummary = z.infer<typeof managedOrderSummarySchema>;

export const managedOrderPageSchema = z.object({
  orders: z.array(managedOrderSummarySchema),
  nextCursor: z.object({
    at: z.iso.datetime({ offset: true }),
    orderId: z.uuid(),
  }).nullable(),
});

export type ManagedOrderPage = z.infer<typeof managedOrderPageSchema>;

const orderModifierSchema = z.object({
  groupName: z.string(),
  optionName: z.string(),
  priceAdjustmentCents: z.number().int(),
});

const orderItemSchema = z.object({
  orderItemId: z.uuid(),
  quantity: z.number().int().positive(),
  itemName: z.string().min(1),
  unitPriceCents: z.number().int().nonnegative(),
  lineTotalCents: z.number().int().nonnegative(),
  specialInstructions: z.string().nullable(),
  modifiers: z.array(orderModifierSchema),
});

export const managedOrderDetailSchema = z.object({
  orderId: z.uuid(),
  orderNumber: z.string().min(1),
  placedAt: z.iso.datetime({ offset: true }),
  pickup: z.object({
    mode: z.enum(["asap", "scheduled"]),
    pickupAt: z.iso.datetime({ offset: true }),
    timezone: z.string().min(1),
  }),
  customer: z.object({
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  }).nullable(),
  orderNotes: z.string().nullable(),
  currency: z.string().length(3),
  subtotalCents: z.number().int().nonnegative(),
  taxCents: z.number().int().nonnegative(),
  tipCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  payment: z.object({
    status: z.string().min(1),
    paidAt: z.iso.datetime({ offset: true }).nullable(),
    refundedCents: z.number().int().nonnegative(),
  }),
  fulfillment: z.object({
    status: fulfillmentStatusSchema,
    version: z.number().int().positive(),
    statusChangedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }).nullable(),
  }),
  items: z.array(orderItemSchema),
  timeline: z.array(z.object({
    id: z.string(),
    kind: z.enum(["fulfillment", "payment"]),
    label: z.string(),
    actorName: z.string().nullable(),
    occurredAt: z.iso.datetime({ offset: true }),
  })),
});

export type ManagedOrderDetail = z.infer<typeof managedOrderDetailSchema>;

export const fulfillmentTransitionRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  nextStatus: fulfillmentStatusSchema.exclude(["new"]),
  clientActionId: z.uuid(),
});

export const fulfillmentTransitionResultSchema = z.object({
  orderId: z.uuid(),
  status: fulfillmentStatusSchema,
  version: z.number().int().positive(),
  statusChangedAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  replayed: z.boolean(),
});

export const managedOrdersQuerySchema = z.object({
  view: orderListViewSchema.default("active"),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  cursorAt: z.iso.datetime({ offset: true }).optional(),
  cursorOrderId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).superRefine((value, context) => {
  if (Boolean(value.cursorAt) !== Boolean(value.cursorOrderId)) {
    context.addIssue({ code: "custom", message: "Both cursor fields are required." });
  }
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: "custom", message: "The date range is invalid." });
  }
});

export type ManagedOrdersQuery = z.infer<typeof managedOrdersQuerySchema>;

export function nextFulfillmentStatus(status: FulfillmentStatus): Exclude<FulfillmentStatus, "new"> | null {
  if (status === "new") return "preparing";
  if (status === "preparing") return "ready";
  if (status === "ready") return "completed";
  return null;
}

export function timingState(pickupAt: string, nowMs: number) {
  const differenceMs = new Date(pickupAt).getTime() - nowMs;
  if (differenceMs < 0) {
    const minutesLate = Math.max(1, Math.ceil(Math.abs(differenceMs) / 60_000));
    return { tone: "late" as const, label: `${minutesLate} min late` };
  }
  const differenceMinutes = Math.ceil(differenceMs / 60_000);
  if (differenceMinutes === 0) return { tone: "due" as const, label: "Due now" };
  if (differenceMinutes <= 10) {
    return { tone: "due" as const, label: `Due in ${differenceMinutes} min` };
  }
  return { tone: "normal" as const, label: `Due in ${differenceMinutes} min` };
}
