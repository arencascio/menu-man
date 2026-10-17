// One request-specific decision per document; never persisted or inferred from
// locale, URLs, or browser-provided country information.
export function createAnalyticsEligibility(fetcher: typeof fetch) {
  let allowed = false;
  let decision: Promise<boolean> | undefined;
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
  };
}

export const analyticsEligibility = createAnalyticsEligibility((...args) => fetch(...args));
