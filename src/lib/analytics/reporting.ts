import { z } from "zod";

export const reportingDays = [7, 30, 90] as const;
export type ReportingEnvironment = "production" | "staging" | "development";
export const metricKeys = ["pageviews", "menuViews", "itemOpenings", "searches", "zeroResults", "delivery", "pickup", "phone", "directions", "internalPickup", "externalPickup"] as const;
export type Metrics = Record<typeof metricKeys[number], number>;
export type DailyMetrics = Metrics & { day: string };
export type AudienceState =
  | { status: "ready"; uniqueBrowsers: number; visits: number; returningBrowsers: number; trackedPageviews: number }
  | { status: "unavailable" };
export type GeographyState =
  | { status: "ready"; local: number; sameState: number; outOfState: number; unknown: number; classifiedPageviews: number; unclassifiedPageviews: number }
  | { status: "unavailable" };
export type AnalyticsReport = {
  environment: ReportingEnvironment;
  days: number;
  from: string;
  until: string;
  daily: DailyMetrics[];
  totals: Metrics;
  popularItems: { itemId: string; openings: number; label: string }[];
  audience: AudienceState;
  geography: GeographyState;
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
// HogQL emits null when pagination metadata is inapplicable to bounded aggregates.
const completedQuery = { error: z.null().optional(), hasMore: z.literal(false).nullish(), query_status: z.object({ complete: z.literal(true) }).nullish() };
const dailyResponse = z.object({ ...completedQuery, results: z.array(dailyRow).max(90) });
const itemsResponse = z.object({ ...completedQuery, results: z.array(itemRow).max(10) });
const audienceResponse = z.object({ ...completedQuery, results: z.array(z.tuple([count, count, count, count])).length(1) });
const geographyResponse = z.object({ ...completedQuery, results: z.array(z.tuple([count, count, count, count, count])).length(1) });
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
  return { ...range, environment, daily, totals, popularItems: items.map(([itemId, openings]) => ({ itemId, openings, label: "Unavailable menu item" })), audience: { status: "unavailable" }, geography: { status: "unavailable" } };
}

export function assembleAudience(input: unknown, pageviews: number): AudienceState {
  const [uniqueBrowsers, visits, returningBrowsers, trackedPageviews] = audienceResponse.parse(input).results[0];
  if (returningBrowsers > uniqueBrowsers || uniqueBrowsers > visits || visits > trackedPageviews || trackedPageviews > pageviews) throw Error("Invalid audience counts");
  return { status: "ready", uniqueBrowsers, visits, returningBrowsers, trackedPageviews };
}

export function assembleGeography(input: unknown, pageviews: number): GeographyState {
  const [local, sameState, outOfState, explicitUnknown, unclassifiedPageviews] = geographyResponse.parse(input).results[0];
  const classifiedPageviews = local + sameState + outOfState + explicitUnknown;
  const unknown = explicitUnknown + unclassifiedPageviews;
  if (![classifiedPageviews, unknown].every(Number.isSafeInteger) || local + sameState + outOfState + unknown !== pageviews) {
    throw Error("Invalid geography counts");
  }
  return { status: "ready", local, sameState, outOfState, unknown, classifiedPageviews, unclassifiedPageviews };
}

export function reportingQueries(restaurantId: string, environment: ReportingEnvironment, range: NonNullable<ReturnType<typeof reportingRange>>) {
  // Only a membership UUID, a closed enum and server-generated timestamps enter SQL.
  z.uuid().parse(restaurantId);
  z.enum(["production", "staging", "development"]).parse(environment);
  const timestamp = (value: string) => z.iso.datetime().parse(value).slice(0, 19).replace("T", " ");
  const historyFrom = new Date(Date.parse(range.from) - 90 * 24 * 60 * 60 * 1000).toISOString();
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
    audience: `SELECT countIf(active_visits > 0) AS unique_browsers,
      sum(active_visits) AS visits,
      countIf(active_visits > 0 AND recorded_visits > 1) AS returning_browsers,
      sum(active_pageviews) AS tracked_pageviews
      FROM (
        SELECT distinct_id,
          uniqExactIf(properties.$session_id, timestamp >= toDateTime('${timestamp(range.from)}', 'UTC')) AS active_visits,
          uniqExact(properties.$session_id) AS recorded_visits,
          countIf(timestamp >= toDateTime('${timestamp(range.from)}', 'UTC')) AS active_pageviews
        FROM events WHERE properties.restaurant_id = '${restaurantId}'
          AND properties.analytics_scope = 'restaurant'
          AND properties.environment = '${environment}'
          AND event = 'page_view'
          AND properties.identity_version = 1 AND properties.identity_mode = 'persistent'
          AND match(toString(distinct_id), '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$')
          AND match(toString(properties.$session_id), '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$')
          AND toString(properties.$device_id) = toString(distinct_id)
          AND timestamp >= toDateTime('${timestamp(historyFrom)}', 'UTC')
          AND timestamp < toDateTime('${timestamp(range.until)}', 'UTC')
          AND NOT startsWith(coalesce(properties.utm_content, ''), 'internal_qa_')
        GROUP BY distinct_id
      )`,
    geography: `SELECT
      countIf(properties.visitor_area = 'local') AS local_pageviews,
      countIf(properties.visitor_area = 'same_state') AS same_state_pageviews,
      countIf(properties.visitor_area = 'out_of_state') AS out_of_state_pageviews,
      countIf(properties.visitor_area = 'unknown') AS explicit_unknown_pageviews,
      countIf(properties.visitor_area IS NULL OR properties.visitor_area NOT IN ('local', 'same_state', 'out_of_state', 'unknown')) AS unclassified_pageviews
      FROM events WHERE ${where} AND event = 'page_view'`,
  };
}
