// One request-specific decision per document; never persisted or inferred from
// locale, URLs, or browser-provided country information.
export type VisitorArea = "local" | "same_state" | "out_of_state" | "unknown";
const visitorAreas = new Set<VisitorArea>(["local", "same_state", "out_of_state", "unknown"]);
const restaurantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createAnalyticsEligibility(fetcher: typeof fetch) {
  let allowed = false;
  let decision: Promise<boolean> | undefined;
  const restaurantAreas = new Map<string, Promise<VisitorArea>>();
  return {
    isAllowed: () => allowed,
    check() {
      return decision ??= (async () => {
        try {
          const response = await fetcher("/api/analytics/eligibility", {
            cache: "no-store", mode: "same-origin", redirect: "error",
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok || response.redirected
            || !/^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? "")) return false;
          const result: unknown = await response.json();
          allowed = result !== null && typeof result === "object" && !Array.isArray(result)
            && Object.keys(result).length === 1 && "allowed" in result && result.allowed === true;
        } catch { /* Missing location, timeout and malformed responses deny analytics. */ }
        return allowed;
      })();
    },
    restaurantArea(restaurantId: string): Promise<VisitorArea> {
      if (!allowed || !restaurantUuid.test(restaurantId)) return Promise.resolve("unknown");
      const existing = restaurantAreas.get(restaurantId);
      if (existing) return existing;
      const request = (async (): Promise<VisitorArea> => {
        try {
          const response = await fetcher("/api/analytics/restaurant-geography", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurant_id: restaurantId }),
            cache: "no-store", mode: "same-origin", redirect: "error",
            signal: AbortSignal.timeout(2500),
          });
          if (!response.ok || response.redirected
            || !/^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? "")) return "unknown";
          const result: unknown = await response.json();
          if (!result || typeof result !== "object" || Array.isArray(result)) return "unknown";
          const record = result as Record<string, unknown>;
          return Object.keys(record).length === 1 && typeof record.visitor_area === "string"
            && visitorAreas.has(record.visitor_area as VisitorArea) ? record.visitor_area as VisitorArea : "unknown";
        } catch { return "unknown"; }
      })();
      restaurantAreas.set(restaurantId, request);
      return request;
    },
  };
}

export const analyticsEligibility = createAnalyticsEligibility((...args) => fetch(...args));
