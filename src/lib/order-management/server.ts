import "server-only";

import { z } from "zod";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import {
  fulfillmentTransitionResultSchema,
  managedRefundReservationSchema,
  managedOrderExportRowSchema,
  managedOrderDetailSchema,
  managedOrderPageSchema,
  managedOrderSummarySchema,
  managedOrderTimelineEventSchema,
  mergeManagedOrderTimeline,
  restaurantMembershipSchema,
  type ManagedOrderDetail,
  type ManagedOrderExportRow,
  type ManagedOrderPage,
  type ManagedOrdersQuery,
  type RestaurantMembership,
} from "./contracts";

export type ManagementErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_REQUEST"
  | "INVALID_TRANSITION"
  | "CONFLICT"
  | "UNAVAILABLE";

export class ManagementError extends Error {
  constructor(public readonly code: ManagementErrorCode, message: string) {
    super(message);
    this.name = "ManagementError";
  }
}

export function rpcError(error: { message: string; code?: string | null }) {
  const match = error.message.match(/MM_MANAGEMENT_([A-Z_]+)\|([^\n]+)/);
  if (match) {
    const code = match[1] as ManagementErrorCode;
    return new ManagementError(code, match[2].trim());
  }
  console.error("[order-management]", {
    stage: "rpc_failure",
    code: error.code ?? null,
    message: error.message,
  });
  return new ManagementError("UNAVAILABLE", "Order management is temporarily unavailable.");
}

export async function authenticatedClient() {
  const client = await createAdminServerClient();
  const { data, error } = await client.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") {
    throw new ManagementError("UNAUTHENTICATED", "Sign in to continue.");
  }
  return client;
}

export async function listRestaurantMemberships(): Promise<RestaurantMembership[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("list_my_restaurant_memberships_v1");
  if (error) throw rpcError(error);
  return (data ?? []).map((row: Record<string, unknown>) => restaurantMembershipSchema.parse({
    membershipId: row.membership_id,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name,
    restaurantSlug: row.restaurant_slug,
    restaurantTimezone: row.restaurant_timezone,
    memberRole: row.member_role,
    displayName: row.display_name,
    capabilities: row.capabilities,
  }));
}

export async function listManagedOrders(
  slug: string,
  query: ManagedOrdersQuery,
): Promise<ManagedOrderPage> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("list_managed_orders_v1", {
    p_restaurant_slug: slug,
    p_view: query.view,
    p_from_date: query.from ?? null,
    p_to_date: query.to ?? null,
    p_cursor_at: query.cursorAt ?? null,
    p_cursor_order_id: query.cursorOrderId ?? null,
    p_limit: query.limit,
    p_date_basis: query.dateBasis,
  });
  if (error) throw rpcError(error);

  const rows = (data ?? []).map((row: Record<string, unknown>) => managedOrderSummarySchema.parse({
    orderId: row.order_id,
    orderNumber: row.order_number,
    placedAt: row.placed_at,
    historyDate: row.history_date,
    pickupMode: row.pickup_mode,
    pickupAt: row.pickup_at,
    pickupTimezone: row.pickup_timezone,
    customerName: row.customer_name,
    itemSummary: row.item_summary,
    itemCount: row.item_count,
    totalCents: row.total_cents,
    currency: row.currency,
    paymentStatus: row.payment_status,
    refundedCents: row.refunded_cents,
    fulfillmentStatus: row.fulfillment_status,
    fulfillmentVersion: row.fulfillment_version,
    statusChangedAt: row.status_changed_at,
    completedAt: row.completed_at,
  }));
  const hasMore = rows.length > query.limit;
  const orders = hasMore ? rows.slice(0, query.limit) : rows;
  const finalOrder = orders.at(-1);
  return managedOrderPageSchema.parse({
    orders,
    nextCursor: hasMore && finalOrder ? {
      at: query.view === "active" ? finalOrder.pickupAt : finalOrder.historyDate,
      orderId: finalOrder.orderId,
    } : null,
  });
}

export async function getManagedOrderDetail(
  slug: string,
  orderId: string,
): Promise<ManagedOrderDetail> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("get_managed_order_detail_v1", {
    p_restaurant_slug: slug,
    p_order_id: orderId,
  });
  if (error) throw rpcError(error);
  const { data: refundData, error: refundError } = await client.rpc("get_managed_order_refunds_v1", {
    p_restaurant_slug: slug,
    p_order_id: orderId,
  });
  if (refundError) throw rpcError(refundError);
  const { data: refundTimelineData, error: refundTimelineError } = await client.rpc(
    "get_managed_order_refund_timeline_v2",
    { p_restaurant_slug: slug, p_order_id: orderId },
  );
  if (refundTimelineError) throw rpcError(refundTimelineError);
  const base = data as Record<string, unknown>;
  const refundView = refundData as { payment?: unknown } | null;
  const originalTimeline = z.array(managedOrderTimelineEventSchema).parse(base.timeline);
  const refundTimeline = z.array(managedOrderTimelineEventSchema).parse(refundTimelineData);
  const timeline = mergeManagedOrderTimeline(originalTimeline, refundTimeline);
  return managedOrderDetailSchema.parse({ ...base, payment: refundView?.payment, timeline });
}

export async function reserveManagedRefund(
  slug: string,
  orderId: string,
  input: { amountCents: number; reason: string; clientActionId: string },
) {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("reserve_managed_refund_v1", {
    p_restaurant_slug: slug,
    p_order_id: orderId,
    p_amount_cents: input.amountCents,
    p_reason: input.reason,
    p_client_action_id: input.clientActionId,
  });
  if (error) throw rpcError(error);
  return managedRefundReservationSchema.parse(data);
}

export async function transitionManagedOrder(
  slug: string,
  orderId: string,
  input: { expectedVersion: number; nextStatus: string; clientActionId: string },
) {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("transition_order_fulfillment_v1", {
    p_restaurant_slug: slug,
    p_order_id: orderId,
    p_expected_version: input.expectedVersion,
    p_next_status: input.nextStatus,
    p_client_action_id: input.clientActionId,
  });
  if (error) throw rpcError(error);
  return fulfillmentTransitionResultSchema.parse(data);
}

type ManagedOrderExportPageQuery = {
  from: string;
  to: string;
  dateBasis: "placed" | "pickup";
  cursorAt?: string;
  cursorOrderId?: string;
  limit: number;
};

export async function createManagedOrderExportPager() {
  const client = await authenticatedClient();
  return async function listManagedOrderExportRowsPage(
    slug: string,
    query: ManagedOrderExportPageQuery,
  ): Promise<{ rows: ManagedOrderExportRow[]; nextCursor: { at: string; orderId: string } | null }> {
    const { data, error } = await client.rpc("list_managed_order_export_rows_v1", {
      p_restaurant_slug: slug,
      p_from_date: query.from,
      p_to_date: query.to,
      p_date_basis: query.dateBasis,
      p_cursor_at: query.cursorAt ?? null,
      p_cursor_order_id: query.cursorOrderId ?? null,
      p_limit: query.limit,
    });
    if (error) throw rpcError(error);
    const parsed = (data ?? []).map((row: Record<string, unknown>) => managedOrderExportRowSchema.parse({
      orderId: row.order_id,
      orderNumber: row.order_number,
      historyAt: row.history_at,
    placedAt: row.placed_at,
    pickupMode: row.pickup_mode,
    pickupAt: row.pickup_at,
      customerName: row.customer_name,
      fulfillmentStatus: row.fulfillment_status,
      paymentStatus: row.payment_status,
      refundStatus: row.refund_status,
      itemCount: row.item_count,
      subtotalCents: row.subtotal_cents,
      taxCents: row.tax_cents,
      tipCents: row.tip_cents,
      totalCents: row.total_cents,
    refundAmountCents: row.refund_amount_cents,
    readyAt: row.ready_at,
    readyOnTime: row.ready_on_time,
    completedAt: row.completed_at,
    }));
    const hasMore = parsed.length > query.limit;
    const rows = hasMore ? parsed.slice(0, query.limit) : parsed;
    const last = rows.at(-1);
    return {
      rows,
      nextCursor: hasMore && last ? { at: last.historyAt, orderId: last.orderId } : null,
    };
  };
}

export async function listManagedOrderExportRows(
  slug: string,
  query: ManagedOrderExportPageQuery,
): Promise<{ rows: ManagedOrderExportRow[]; nextCursor: { at: string; orderId: string } | null }> {
  const pager = await createManagedOrderExportPager();
  return pager(slug, query);
}

export function managementErrorStatus(error: unknown) {
  if (!(error instanceof ManagementError)) return 500;
  if (error.code === "UNAUTHENTICATED") return 401;
  if (error.code === "FORBIDDEN") return 403;
  if (error.code === "NOT_FOUND") return 404;
  if (error.code === "CONFLICT") return 409;
  if (error.code === "INVALID_REQUEST" || error.code === "INVALID_TRANSITION") return 400;
  return 503;
}
