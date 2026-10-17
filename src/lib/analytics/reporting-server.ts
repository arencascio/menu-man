import "server-only";

import { z } from "zod";
import { listRestaurantMemberships, ManagementError } from "@/lib/order-management/server";
import { assembleReport, reportingEnvironment, reportingQueries, reportingRange, type ReportingState } from "./reporting";

function configuration() {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const project = process.env.POSTHOG_PROJECT_ID;
  const host = process.env.POSTHOG_QUERY_HOST ?? "https://us.posthog.com";
  if (!key || !project || !/^\d{1,12}$/.test(project) || !["https://us.posthog.com", "https://eu.posthog.com"].includes(host)) return null;
  return { key, url: `${host}/api/projects/${project}/query/` };
}

class ReportingHttpError extends Error {
  constructor(readonly status: number) { super("Reporting provider unavailable"); }
}

async function query(config: NonNullable<ReturnType<typeof configuration>>, sql: string) {
  const response = await fetch(config.url, {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000),
    headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql }, refresh: "force_blocking" }),
  });
  if (!response.ok) throw new ReportingHttpError(response.status);
  return response.json() as Promise<unknown>;
}

// This is the sole reporting entry point. No caller can supply an authorized ID.
export async function loadOwnerAnalytics(slug: string, requestedRange: unknown) {
  const authorize = async () => {
    const memberships = await listRestaurantMemberships();
    const owner = memberships.find((entry) => entry.restaurantSlug === slug && entry.memberRole === "owner");
    if (!owner) throw new ManagementError("FORBIDDEN", "Owner access is required for analytics.");
    return owner;
  };
  const membership = await authorize();
  const range = reportingRange(requestedRange);
  let state: ReportingState;
  const config = configuration();
  const environment = reportingEnvironment(process.env);
  if (!range) state = { status: "invalid_range" };
  else if (!environment) state = { status: "unavailable", reason: "environment" };
  else if (!config) state = { status: "unavailable", reason: "configuration" };
  else {
    try {
      const sql = reportingQueries(membership.restaurantId, environment, range);
      const [daily, items] = await Promise.all([query(config, sql.daily), query(config, sql.items)]);
      const report = assembleReport(range, environment, daily, items);
      // Catalog names are optional decoration, always scoped to this membership.
      if (report.popularItems.length) {
        try {
          // Reuse the platform's server-only catalog reader after owner authorization.
          // Load lazily so missing catalog configuration only affects optional labels.
          const { supabaseServer } = await import("@/lib/supabase/server");
          const { data, error } = await supabaseServer.from("menu_items").select("id, restaurant_id, name")
            .eq("restaurant_id", membership.restaurantId).in("id", report.popularItems.map((item) => item.itemId));
          if (!error) {
            const names = z.array(z.object({ id: z.uuid(), restaurant_id: z.uuid(), name: z.string().trim().min(1).max(300) })).max(10).parse(data);
            for (const item of report.popularItems) item.label = names.find((name) => name.restaurant_id === membership.restaurantId && name.id === item.itemId)?.name ?? item.label;
          }
        } catch { /* Historical/deleted items still have valid aggregate counts. */ }
      }
      state = { status: "ready", report };
    } catch (error) {
      // Bounded operational diagnostics only; never provider text, queries or data.
      console.error("[analytics-reporting]", error instanceof ReportingHttpError
        ? { category: "http", status: error.status }
        : error instanceof z.ZodError
          ? { category: "invalid_response", fields: [...new Set(error.issues.map((issue) => issue.path[0]).filter((field) => ["results", "error", "hasMore", "query_status"].includes(String(field))))] }
          : { category: "request_or_aggregation" });
      state = { status: "unavailable", reason: "provider" };
    }
  }
  // Re-read authoritative membership before releasing results, including failures.
  const current = await authorize();
  if (current.membershipId !== membership.membershipId || current.restaurantId !== membership.restaurantId) {
    throw new ManagementError("FORBIDDEN", "Restaurant access changed. Reload to continue.");
  }
  return { membership: current, state };
}
