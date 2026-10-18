export type VisitorArea = "local" | "same_state" | "out_of_state" | "unknown";

type RestaurantLocation = { city: string | null; state: string | null };

const states: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

const stateCodes = new Map(Object.entries(states).flatMap(([code, name]) => [[code, code], [name.toUpperCase(), code]]));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

function normalizeState(value: string | null | undefined) {
  const candidate = value?.trim().replace(/^US-/i, "").toUpperCase();
  return candidate ? stateCodes.get(candidate) ?? null : null;
}

function normalizeCity(value: string | null | undefined, encoded = false) {
  if (!value || value.length > 200 || /placeholder/i.test(value)) return null;
  let city = value;
  if (encoded) {
    try { city = decodeURIComponent(value); } catch { return null; }
  }
  if (/[%\u0000-\u001f\u007f]/.test(city)) return null;
  const normalized = city.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  return normalized && normalized.length <= 100 ? normalized : null;
}

export function classifyVisitorArea(input: {
  country: string | null;
  visitorState: string | null;
  visitorCity: string | null;
  restaurant: RestaurantLocation | null;
}): VisitorArea {
  if (input.country !== "US" || !input.restaurant) return "unknown";
  const visitorState = normalizeState(input.visitorState);
  const restaurantState = normalizeState(input.restaurant.state);
  const visitorCity = normalizeCity(input.visitorCity, true);
  const restaurantCity = normalizeCity(input.restaurant.city);
  if (!visitorState || !restaurantState || !visitorCity || !restaurantCity) return "unknown";
  if (visitorState !== restaurantState) return "out_of_state";
  return visitorCity === restaurantCity ? "local" : "same_state";
}

export function createRestaurantGeographyHandler(input: {
  vercel: string | undefined;
  vercelEnv: string | undefined;
  lookupRestaurant: (restaurantId: string) => Promise<RestaurantLocation | null>;
}) {
  return async (request: Request) => {
    const unknown = () => Response.json({ visitor_area: "unknown" }, { headers: noStoreHeaders });
    const trustedIngress = input.vercel === "1" && ["production", "preview"].includes(input.vercelEnv ?? "");
    if (!trustedIngress || request.headers.get("x-vercel-ip-country") !== "US") return unknown();

    try {
      if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) return unknown();
      const body: unknown = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) return unknown();
      const record = body as Record<string, unknown>;
      if (Object.keys(record).length !== 1 || typeof record.restaurant_id !== "string" || !uuid.test(record.restaurant_id)) return unknown();
      const restaurant = await input.lookupRestaurant(record.restaurant_id);
      const visitorArea = classifyVisitorArea({
        country: request.headers.get("x-vercel-ip-country"),
        visitorState: request.headers.get("x-vercel-ip-country-region"),
        visitorCity: request.headers.get("x-vercel-ip-city"),
        restaurant,
      });
      return Response.json({ visitor_area: visitorArea }, { headers: noStoreHeaders });
    } catch {
      return unknown();
    }
  };
}
