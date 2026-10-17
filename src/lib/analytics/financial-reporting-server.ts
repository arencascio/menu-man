import "server-only";
import { assembleFinancialReport, financialEnvironments, financialRowLimit, type FinancialRange, type FinancialState } from "./financial-reporting";
import type { ReportingEnvironment } from "./reporting";

type Page = { data: unknown[] | null; error: unknown; count: number | null };
const pageSize = 500;
async function completeRows(fetchPage: (offset: number) => PromiseLike<Page>) {
  const rows: unknown[] = [];
  let total: number | undefined;
  do {
    const result = await fetchPage(rows.length);
    if (result.error || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0
      || result.count > financialRowLimit || (total !== undefined && result.count !== total)) throw Error("Incomplete financial records");
    total = result.count;
    if (!result.data || result.data.length !== Math.min(pageSize, total - rows.length)) throw Error("Incomplete financial page");
    rows.push(...result.data);
  } while (rows.length < total);
  return rows;
}

// Internal reader: only invoked after loadOwnerAnalytics resolves an owner membership.
// Never return records or accept a browser-supplied restaurant ID at a route boundary.
export async function readOwnerFinancials(restaurantId: string, environment: ReportingEnvironment, range: FinancialRange): Promise<FinancialState> {
  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const signal = AbortSignal.timeout(12_000);
    const environments = financialEnvironments(environment);
    const paymentColumns = "id,restaurant_id,order_id,connection_id,currency,captured_cents,succeeded_at,connection:restaurant_payment_connections!inner(restaurant_id,environment,provider_key),order:orders!inner(id,restaurant_id,order_status)";
    const refundColumns = "id,restaurant_id,payment_id,connection_id,currency,amount_cents,status,completed_at,connection:restaurant_payment_connections!inner(restaurant_id,environment,provider_key),payment:payments!inner(id,restaurant_id,connection_id,currency,captured_cents,succeeded_at)";
    const base = (table: "payments" | "refunds", columns: string) => supabaseServer.from(table).select(columns, { count: "exact" })
      .eq("restaurant_id", restaurantId).eq("connection.restaurant_id", restaurantId).in("connection.environment", environments).abortSignal(signal);
    const [payments, refunds, undatedPayments, undatedRefunds] = await Promise.all([
      completeRows((offset) => base("payments", paymentColumns).gt("captured_cents", 0).gte("succeeded_at", range.from).lt("succeeded_at", range.until).order("id").range(offset, offset + pageSize - 1)),
      completeRows((offset) => base("refunds", refundColumns).eq("status", "succeeded").gte("completed_at", range.from).lt("completed_at", range.until).order("id").range(offset, offset + pageSize - 1)),
      Promise.resolve().then(() => base("payments", "id,connection:restaurant_payment_connections!inner(restaurant_id,environment)").gt("captured_cents", 0).is("succeeded_at", null).limit(1)),
      Promise.resolve().then(() => base("refunds", "id,connection:restaurant_payment_connections!inner(restaurant_id,environment)").eq("status", "succeeded").is("completed_at", null).limit(1)),
    ]);
    if (undatedPayments.error || undatedRefunds.error || undatedPayments.count !== 0 || undatedRefunds.count !== 0) return { status: "unavailable" };
    return assembleFinancialReport(restaurantId, environment, range, payments, refunds);
  } catch {
    // No payment/customer/provider details or credentials are logged.
    return { status: "unavailable" };
  }
}
