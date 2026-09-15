import { z } from "zod";

export const managementCapabilitySchema = z.enum([
  "view_orders",
  "advance_fulfillment",
  "view_customer_contact",
  "export_order_history",
  "issue_refunds",
  "correct_fulfillment",
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

export const restaurantTeamMemberSchema = z.object({
  membershipId: z.uuid(),
  userId: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1).max(200),
  role: managementRoleSchema,
  status: z.enum(["invited", "active", "revoked"]),
  invitedAt: z.iso.datetime({ offset: true }).nullable(),
  joinedAt: z.iso.datetime({ offset: true }).nullable(),
  membershipCreatedAt: z.iso.datetime({ offset: true }),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
  capabilities: z.array(managementCapabilitySchema),
  roleDefaultCapabilities: z.array(managementCapabilitySchema),
});

export type RestaurantTeamMember = z.infer<typeof restaurantTeamMemberSchema>;

const membershipAssignmentSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  role: managementRoleSchema,
  capabilities: z.array(managementCapabilitySchema).max(20)
    .transform((values) => [...new Set(values)].sort()),
  clientActionId: z.uuid(),
});

export const inviteRestaurantMemberRequestSchema = membershipAssignmentSchema.extend({
  email: z.string().trim().transform((value) => value.toLowerCase()).pipe(z.email()),
});

export const updateRestaurantMemberRequestSchema = membershipAssignmentSchema;

export const revokeRestaurantMemberRequestSchema = z.object({
  reason: z.string().trim().max(500).default(""),
  clientActionId: z.uuid(),
});

export const membershipActionRequestSchema = z.object({ clientActionId: z.uuid() });

export const restaurantAccessEventSchema = z.object({
  eventId: z.coerce.string(),
  targetMembershipId: z.uuid(),
  targetDisplayName: z.string(),
  actorDisplayName: z.string().nullable(),
  action: z.string(),
  previousState: z.record(z.string(), z.unknown()),
  nextState: z.record(z.string(), z.unknown()),
  reason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime({ offset: true }),
});

export type RestaurantAccessEvent = z.infer<typeof restaurantAccessEventSchema>;

export const managedOrderExportQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  dateBasis: z.enum(["placed", "pickup"]).default("placed"),
}).refine((value) => value.from <= value.to, {
  message: "The export date range is invalid.",
});

export const managedOrderExportRowSchema = z.object({
  orderId: z.uuid(),
  orderNumber: z.string().min(1),
  historyAt: z.iso.datetime({ offset: true }),
  placedAt: z.iso.datetime({ offset: true }),
  pickupAt: z.iso.datetime({ offset: true }),
  customerName: z.string().nullable(),
  fulfillmentStatus: fulfillmentStatusSchema,
  paymentStatus: z.string(),
  refundStatus: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
  subtotalCents: z.number().int().nonnegative(),
  taxCents: z.number().int().nonnegative(),
  tipCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  refundAmountCents: z.number().int().nonnegative(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
});

export type ManagedOrderExportRow = z.infer<typeof managedOrderExportRowSchema>;

const capabilityLabels: Record<ManagementCapability, string> = {
  view_orders: "View orders",
  advance_fulfillment: "Advance fulfillment",
  view_customer_contact: "View customer contact",
  export_order_history: "Export order history",
  issue_refunds: "Issue refunds",
  correct_fulfillment: "Correct fulfillment",
  manage_memberships: "Manage team",
};

function stateCapabilities(state: Record<string, unknown>) {
  if (!Array.isArray(state.capabilities)) return [] as ManagementCapability[];
  return state.capabilities.filter((value): value is ManagementCapability =>
    managementCapabilitySchema.safeParse(value).success,
  );
}

function titleCaseRole(value: unknown) {
  return typeof value === "string" && managementRoleSchema.safeParse(value).success
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : null;
}

export function describeRestaurantAccessEvent(event: RestaurantAccessEvent) {
  const titles: Record<string, string> = {
    "membership.bootstrapped": "Owner access created",
    "membership.created": "Team member created",
    "membership.updated": "Team member updated",
    "membership.invited": "Invitation sent",
    "membership.invitation_resend_requested": "Invitation resend requested",
    "membership.invitation_resent": "Invitation resent",
    "membership.invitation_resend_failed": "Invitation resend failed",
    "membership.activated": "Access activated",
    "membership.reinstated": "Access reinstated",
    "membership.role_changed": "Role changed",
    "membership.capabilities_changed": "Permissions changed",
    "membership.revoked": "Access revoked",
    "permission.changed": "Permissions changed",
  };
  const details: string[] = [];
  const previousRole = titleCaseRole(event.previousState.role);
  const nextRole = titleCaseRole(event.nextState.role);
  if (previousRole && nextRole && previousRole !== nextRole) {
    details.push(`${previousRole} → ${nextRole}`);
  }
  const previous = new Set(stateCapabilities(event.previousState));
  const next = new Set(stateCapabilities(event.nextState));
  const showPermissionDelta = [
    "membership.updated", "membership.role_changed",
    "membership.capabilities_changed", "permission.changed",
  ].includes(event.action);
  if (showPermissionDelta) {
    const added = [...next].filter((capability) => !previous.has(capability));
    const removed = [...previous].filter((capability) => !next.has(capability));
    if (added.length) details.push(`Added: ${added.map((capability) => capabilityLabels[capability]).join(", ")}`);
    if (removed.length) details.push(`Removed: ${removed.map((capability) => capabilityLabels[capability]).join(", ")}`);
  }
  return { title: titles[event.action] ?? "Team access updated", details };
}

export const managedOrderSummarySchema = z.object({
  orderId: z.uuid(),
  orderNumber: z.string().min(1),
  placedAt: z.iso.datetime({ offset: true }),
  historyDate: z.iso.datetime({ offset: true }),
  pickupMode: z.enum(["asap", "scheduled"]),
  pickupAt: z.iso.datetime({ offset: true }),
  pickupTimezone: z.string().min(1),
  customerName: z.string().nullable(),
  itemSummary: z.array(z.object({
    quantity: z.number().int().positive(),
    itemName: z.string().min(1),
  })),
  itemCount: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
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
  dateBasis: z.enum(["placed", "pickup"]).default("placed"),
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

export function formatQueuePaymentLabel(
  paymentStatus: string,
  refundedCents: number,
  currency = "USD",
) {
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(refundedCents / 100);
  if (paymentStatus === "refunded") return `REFUNDED · ${amount}`;
  if (paymentStatus === "partially_refunded") return `PARTIALLY REFUNDED · ${amount}`;
  return paymentStatus.replaceAll("_", " ").toUpperCase();
}
