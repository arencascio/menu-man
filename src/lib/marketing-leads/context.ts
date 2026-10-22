import { leadContextSchema, sourcePages, type LeadContext } from "./persistence";

// Current-page context only. No new cookies, identity, analytics calls, or storage.
export function currentLeadContext(): LeadContext {
  if (typeof window === "undefined") return { attribution: {} };
  try {
    const page = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const attribution: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
      const value = params.get(key);
      if (params.getAll(key).length === 1 && value && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)) attribution[key] = value;
    }
    if (!document.referrer) attribution.referrer = "direct";
    else {
      const referrer = new URL(document.referrer);
      attribution.referrer = referrer.origin === window.location.origin ? "internal"
        : /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com)$/.test(referrer.hostname) ? "search"
        : /(^|\.)(facebook\.com|instagram\.com|t\.co|linkedin\.com)$/.test(referrer.hostname) ? "social" : "other";
    }
    return leadContextSchema.parse({ ...(sourcePages.includes(page as typeof sourcePages[number]) ? { sourcePage: page } : {}), attribution });
  } catch { return { attribution: {} }; }
}
