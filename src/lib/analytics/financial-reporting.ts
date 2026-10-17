import { z } from "zod";
import type { ReportingEnvironment, reportingRange } from "./reporting";

export type FinancialRange = NonNullable<ReturnType<typeof reportingRange>>;
export type FinancialState =
  | { status: "ready"; report: FinancialRange & {
    environment: ReportingEnvironment; paidOrders: number; completedPaidOrders: number; cancelledPaidOrders: number;
    currencies: { currency: string; grossCents: number; refundCents: number; netCents: number }[];
  } }
  | { status: "unavailable" };

// Bounded, complete paginated reads; never silently total a truncated result.
export const financialRowLimit = 10000;
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const connection = z.object({ restaurant_id: z.uuid(), environment: z.enum(["test", "sandbox", "production"]), provider_key: z.string().min(1) });
const payment = z.object({
  id: z.uuid(), restaurant_id: z.uuid(), order_id: z.uuid(), connection_id: z.uuid(),
  currency: z.string().regex(/^[A-Z]{3}$/), captured_cents: cents, succeeded_at: z.iso.datetime({ offset: true }),
  connection,
  order: z.object({ id: z.uuid(), restaurant_id: z.uuid(), order_status: z.enum(["pending_payment", "placed", "confirmed", "preparing", "ready", "completed", "cancelled"]) }),
});
const refund = z.object({
  id: z.uuid(), restaurant_id: z.uuid(), payment_id: z.uuid(), connection_id: z.uuid(),
  currency: z.string().regex(/^[A-Z]{3}$/), amount_cents: cents.positive(), status: z.literal("succeeded"), completed_at: z.iso.datetime({ offset: true }),
  connection,
  payment: z.object({ id: z.uuid(), restaurant_id: z.uuid(), connection_id: z.uuid(), currency: z.string(), captured_cents: cents.positive(), succeeded_at: z.iso.datetime({ offset: true }) }),
});

export function financialEnvironments(environment: ReportingEnvironment) {
  return environment === "production" ? ["production"] : ["test", "sandbox"];
}

export function assembleFinancialReport(restaurantId: string, environment: ReportingEnvironment, range: FinancialRange, paymentsInput: unknown, refundsInput: unknown): FinancialState {
  z.uuid().parse(restaurantId);
  const payments = z.array(payment).max(financialRowLimit).parse(paymentsInput);
  const refunds = z.array(refund).max(financialRowLimit).parse(refundsInput);
  const allowed = financialEnvironments(environment);
  const inRange = (date: string) => Date.parse(date) >= Date.parse(range.from) && Date.parse(date) < Date.parse(range.until);
  const belongs = (row: { restaurant_id: string; connection: z.infer<typeof connection> }) => row.restaurant_id === restaurantId
    && row.connection.restaurant_id === restaurantId && allowed.includes(row.connection.environment)
    && (environment !== "production" || row.connection.provider_key !== "fake");
  const seen = new Set<string>();
  const orderIds = new Set<string>();
  const currencies = new Map<string, { currency: string; grossCents: number; refundCents: number; netCents: number }>();
  const money = (currency: string) => {
    if (!currencies.has(currency)) currencies.set(currency, { currency, grossCents: 0, refundCents: 0, netCents: 0 });
    return currencies.get(currency)!;
  };
  let completedPaidOrders = 0;
  let cancelledPaidOrders = 0;
  for (const row of payments) {
    if (!belongs(row) || !inRange(row.succeeded_at) || row.captured_cents <= 0 || row.order.restaurant_id !== restaurantId
      || row.order.id !== row.order_id || seen.has(row.id) || orderIds.has(row.order_id)) throw Error("Invalid financial records");
    seen.add(row.id); orderIds.add(row.order_id);
    money(row.currency).grossCents += row.captured_cents;
    completedPaidOrders += Number(row.order.order_status === "completed");
    cancelledPaidOrders += Number(row.order.order_status === "cancelled");
  }
  seen.clear();
  const refundedByPayment = new Map<string, number>();
  for (const row of refunds) {
    if (!belongs(row) || !inRange(row.completed_at) || row.payment.restaurant_id !== restaurantId || row.payment.id !== row.payment_id
      || row.payment.connection_id !== row.connection_id || row.payment.currency !== row.currency
      || row.payment.captured_cents < row.amount_cents || Date.parse(row.payment.succeeded_at) > Date.parse(row.completed_at)
      || seen.has(row.id)) throw Error("Invalid financial records");
    seen.add(row.id);
    const refunded = (refundedByPayment.get(row.payment_id) ?? 0) + row.amount_cents;
    if (!Number.isSafeInteger(refunded) || refunded > row.payment.captured_cents) throw Error("Invalid refund totals");
    refundedByPayment.set(row.payment_id, refunded);
    money(row.currency).refundCents += row.amount_cents;
  }
  for (const value of currencies.values()) {
    value.netCents = value.grossCents - value.refundCents;
    if (![value.grossCents, value.refundCents, value.netCents].every(Number.isSafeInteger)) throw Error("Invalid financial totals");
  }
  return { status: "ready", report: { ...range, environment, paidOrders: payments.length, completedPaidOrders, cancelledPaidOrders,
    currencies: [...currencies.values()].sort((a, b) => a.currency.localeCompare(b.currency)) } };
}
