import type { MarketingCta, MarketingEvent, MarketingForm, MarketingPage, MarketingPlacement } from "./types";

export const marketingPages = ["/", "/services", "/work", "/build-my-website"] as const;
const ctas = ["build_website", "website_review", "explore_product", "services_pricing", "site_like_this"] as const;
const placements = ["hero", "navigation", "section", "footer", "final_cta", "form"] as const;
const campaignKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
const campaignStorageKey = "menu-man:marketing-campaign:v1";
export type Campaign = Partial<Record<(typeof campaignKeys)[number], string>>;

export function marketingEnvironment(vercelEnvironment?: string) {
  if (vercelEnvironment === "production") return "production";
  if (vercelEnvironment === "preview") return "staging";
  if (vercelEnvironment === "development") return "development";
  return "unknown";
}

export function sanitizeCampaign(input: Record<string, unknown>): Campaign {
  return Object.fromEntries(campaignKeys.flatMap((key) => {
    const value = input[key];
    // Campaign codes, not arbitrary prose, email addresses or URLs.
    return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value) ? [[key, value]] : [];
  }));
}

export function marketingCta(cta: MarketingCta, placement: MarketingPlacement, destination: "page" | "modal" = "page") {
  return { "data-marketing-cta": cta, "data-marketing-placement": placement, "data-marketing-destination": destination };
}

// Only explicit, bounded metadata is read from the clicked element. Never read href/text/form fields.
export function marketingClick(data: Record<string, string | undefined>): MarketingEvent | null {
  if (!placements.includes(data.marketingPlacement as MarketingPlacement)) return null;
  const placement = data.marketingPlacement as MarketingPlacement;
  if (data.marketingEmail !== undefined) {
    const form = data.marketingEmail;
    if (!["general", "website_inquiry", "website_review"].includes(form)) return null;
    return { name: "marketing_email_clicked", placement,
      ...(form === "general" ? {} : { form_type: form as MarketingForm }) };
  }
  if (!ctas.includes(data.marketingCta as MarketingCta) || !["page", "modal"].includes(data.marketingDestination ?? "")) return null;
  return { name: "marketing_cta_clicked", cta_id: data.marketingCta as MarketingCta, placement,
    destination_type: data.marketingDestination as "page" | "modal" };
}

export function createMarketingAnalytics(
  send: (name: string, properties: Record<string, unknown>) => void,
  allowed: () => boolean,
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
) {
  let lastPage: string | null = null;
  let campaign: Campaign | undefined;
  function context(path: string, search: string) {
    if (!marketingPages.includes(path as MarketingPage)) return null;
    if (!allowed()) {
      campaign = undefined;
      lastPage = null;
      try { storage?.removeItem(campaignStorageKey); } catch { /* Storage may be blocked. */ }
      return null;
    }
    if (!campaign) {
      try {
        const stored: unknown = JSON.parse(storage?.getItem(campaignStorageKey) ?? "null");
        if (stored && typeof stored === "object" && !Array.isArray(stored)) {
          const safe = sanitizeCampaign(stored as Record<string, unknown>);
          if (Object.keys(safe).length) campaign = safe;
        }
      } catch { /* Keep attribution in memory when storage is unavailable. */ }
      if (!campaign) {
        const params = new URLSearchParams(search);
        const safe = sanitizeCampaign(Object.fromEntries(campaignKeys.filter((key) => params.getAll(key).length === 1).map((key) => [key, params.get(key)])));
        if (Object.keys(safe).length) {
          campaign = safe;
          try { storage?.setItem(campaignStorageKey, JSON.stringify(safe)); } catch { /* Memory fallback. */ }
        }
      }
    }
    return { analytics_scope: "marketing", page: path, ...campaign };
  }
  return {
    visit(path: string, search = "") {
      try {
        if (!marketingPages.includes(path as MarketingPage)) { lastPage = null; return; }
        const properties = context(path, search);
        if (!properties || lastPage === path) return;
        lastPage = path;
        send("$pageview", properties);
      } catch { /* Analytics never blocks rendering. */ }
    },
    track(event: MarketingEvent, path: string, search = "") {
      try {
        const properties = context(path, search);
        if (!properties) return;
        const { name, ...details } = event;
        send(name, { ...properties, ...details });
      } catch { /* Analytics never blocks clicks or lead delivery. */ }
    },
  };
}

export function createMarketingFormAnalytics(form_type: MarketingForm, track: (event: MarketingEvent) => void) {
  let opened = false;
  let started = false;
  function emit(event: MarketingEvent) { try { track(event); } catch { /* Best effort. */ } }
  return {
    open() { if (!opened) { opened = true; started = false; emit({ name: "marketing_form_opened", form_type }); } },
    close() { opened = false; },
    start() { if (!started) { started = true; emit({ name: "marketing_form_started", form_type }); } },
  };
}

const sdkKeys = ["token", "distinct_id", "$device_id", "$session_id", "$window_id", "$lib", "$lib_version", "$insert_id"];
const eventKeys = ["analytics_scope", "environment", "page", "cta_id", "placement", "destination_type", "form_type", "failure_category", ...campaignKeys];

// Final SDK boundary: strip automatic current/initial/referrer URLs and person properties,
// including nested $set/$set_once, only for our explicitly scoped marketing events.
export function sanitizeMarketingCapture<T extends { properties: Record<string, unknown> }>(event: T): T {
  if (event.properties.analytics_scope !== "marketing") return event;
  const properties = Object.fromEntries([...sdkKeys, ...eventKeys].filter((key) => key in event.properties).map((key) => [key, event.properties[key]]));
  return { ...event, properties };
}
