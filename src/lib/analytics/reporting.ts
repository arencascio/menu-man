import { z } from "zod";

export const reportingDays = [7, 30, 90] as const;
export type ReportingEnvironment = "production" | "staging" | "development";
export const metricKeys = ["pageviews", "menuViews", "itemOpenings", "searches", "zeroResults", "delivery", "pickup", "phone", "directions", "internalPickup", "externalPickup"] as const;
export type Metrics = Record<typeof metricKeys[number], number>;
export type DailyMetrics = Metrics & { day: string };
export type AnalyticsReport = {
  environment: ReportingEnvironment;
  days: number;
  from: string;
  until: string;
  daily: DailyMetrics[];
  totals: Metrics;
  popularItems: { itemId: string; openings: number; label: string }[];
};
export type ReportingState =
  | { status: "ready"; report: AnalyticsReport }
  | { status: "unavailable"; reason: "configuration" | "environment" | "provider" }
  | { status: "invalid_range" };

export function reportingRange(value: unknown, now = new Date()) {
  const days = value === undefined ? 30 : value === "7" ? 7 : value === "30" ? 30 : value === "90" ? 90 : null;
  if (days === null || !Number.isFinite(now.getTime())) return null;
  const until = new Date(Math.floor(now.getTime() / 1000) * 1000);
  const from = new Date(until);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { days, from: from.toISOString(), until: until.toISOString() };
}

export function reportingEnvironment(env: Record<string, string | undefined>): ReportingEnvironment | null {
  // Vercel classification wins; an unknown deployed value must never fall back.
  if (env.VERCEL_ENV !== undefined) {
    return env.VERCEL_ENV === "production" ? "production" : env.VERCEL_ENV === "preview" ? "staging" : env.VERCEL_ENV === "development" ? "development" : null;
  }
  return env.MENU_MAN_ENV === "staging" ? "staging" : env.NODE_ENV === "development" ? "development" : null;
}

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const dailyRow = z.tuple([z.iso.date(), count, count, count, count, count, count, count, count, count, count, count]);
const itemRow = z.tuple([z.uuid(), count]);
const completedQuery = { error: z.null().optional(), hasMore: z.literal(false).optional(), query_status: z.object({ complete: z.literal(true) }).nullish() };
const dailyResponse = z.object({ ...completedQuery, results: z.array(dailyRow).max(90) });
const itemsResponse = z.object({ ...completedQuery, results: z.array(itemRow).max(10) });
const zeroMetrics = (): Metrics => Object.fromEntries(metricKeys.map((key) => [key, 0])) as Metrics;

export function assembleReport(range: NonNullable<ReturnType<typeof reportingRange>>, environment: ReportingEnvironment, dailyInput: unknown, itemsInput: unknown): AnalyticsReport {
  const rows = dailyResponse.parse(dailyInput).results;
  const items = itemsResponse.parse(itemsInput).results;
  const daily: DailyMetrics[] = [];
  for (let i = 0; i < range.days; i++) {
    const date = new Date(range.from);
    date.setUTCDate(date.getUTCDate() + i);
    daily.push({ day: date.toISOString().slice(0, 10), ...zeroMetrics() });
  }
  const seen = new Set<string>();
  for (const [day, ...values] of rows) {
    const target = daily.find((entry) => entry.day === day);
    if (!target || seen.has(day)) throw Error("Invalid reporting day");
    seen.add(day);
    metricKeys.forEach((key, i) => { target[key] = values[i]; });
    if (target.menuViews > target.pageviews || target.zeroResults > target.searches || target.internalPickup + target.externalPickup > target.pickup) throw Error("Invalid reporting counts");
  }
  const totals = zeroMetrics();
  for (const entry of daily) for (const key of metricKeys) {
    totals[key] += entry[key];
    if (!Number.isSafeInteger(totals[key])) throw Error("Invalid reporting total");
  }
  if (new Set(items.map(([id]) => id)).size !== items.length || items.reduce((n, [, value]) => n + value, 0) > totals.itemOpenings) throw Error("Invalid item counts");
  return { ...range, environment, daily, totals, popularItems: items.map(([itemId, openings]) => ({ itemId, openings, label: `Menu item ${itemId.slice(-6)}` })) };
}

export function reportingQueries(restaurantId: string, environment: ReportingEnvironment, range: NonNullable<ReturnType<typeof reportingRange>>) {
  // Only a membership UUID, a closed enum and server-generated timestamps enter SQL.
  z.uuid().parse(restaurantId);
  z.enum(["production", "staging", "development"]).parse(environment);
  const timestamp = (value: string) => z.iso.datetime().parse(value).slice(0, 19).replace("T", " ");
  const where = `properties.restaurant_id = '${restaurantId}'
    AND properties.analytics_scope = 'restaurant'
    AND properties.environment = '${environment}'
    AND timestamp >= toDateTime('${timestamp(range.from)}', 'UTC')
    AND timestamp < toDateTime('${timestamp(range.until)}', 'UTC')
    AND NOT startsWith(coalesce(properties.utm_content, ''), 'internal_qa_')`;
  return {
    daily: `SELECT formatDateTime(timestamp, '%Y-%m-%d', 'UTC') AS day,
      countIf(event = 'page_view'), countIf(event = 'page_view' AND properties.page_type = 'menu'),
      countIf(event = 'menu_item_expanded'), countIf(event = 'menu_search'),
      countIf(event = 'menu_search' AND properties.zero_results = true),
      countIf(event = 'delivery_clicked'), countIf(event = 'pickup_clicked'),
      countIf(event = 'phone_clicked'), countIf(event = 'directions_clicked'),
      countIf(event = 'pickup_clicked' AND properties.pickup_action = 'internal_selection'),
      countIf(event = 'pickup_clicked' AND properties.pickup_action = 'external_departure')
      FROM events WHERE ${where}
      AND event IN ('page_view', 'menu_item_expanded', 'menu_search', 'delivery_clicked', 'pickup_clicked', 'phone_clicked', 'directions_clicked')
      GROUP BY day ORDER BY day LIMIT 90`,
    items: `SELECT toString(properties.item_id) AS item_id, count() AS openings
      FROM events WHERE ${where} AND event = 'menu_item_expanded'
      AND match(toString(properties.item_id), '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$')
      GROUP BY item_id ORDER BY openings DESC, item_id LIMIT 10`,
  };
}
