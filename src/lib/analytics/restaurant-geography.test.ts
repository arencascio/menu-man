import assert from "node:assert/strict";
import test from "node:test";
import { classifyVisitorArea, createRestaurantGeographyHandler } from "./restaurant-geography";
import { sanitizeRestaurantCapture } from "./restaurant";

const restaurantId = "20000000-0000-4000-8000-000000000001";
const restaurant = { city: "San Francisco", state: "California" };

function request(country = "US", state = "CA", city = "San%20Francisco", body: unknown = { restaurant_id: restaurantId }) {
  return new Request("https://site.invalid/api/analytics/restaurant-geography", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-vercel-ip-country": country,
      "x-vercel-ip-country-region": state, "x-vercel-ip-city": city },
    body: JSON.stringify(body),
  });
}

test("classifies normalized matching city/state, same state and out-of-state visitors", () => {
  assert.equal(classifyVisitorArea({ country: "US", visitorState: "US-CA", visitorCity: "SAN%20FRANCISCO", restaurant }), "local");
  assert.equal(classifyVisitorArea({ country: "US", visitorState: "CA", visitorCity: "Oakland", restaurant }), "same_state");
  assert.equal(classifyVisitorArea({ country: "US", visitorState: "NV", visitorCity: "Las%20Vegas", restaurant }), "out_of_state");
  assert.equal(classifyVisitorArea({ country: "US", visitorState: "CA", visitorCity: "San-Francisco", restaurant }), "local");
});

test("missing, malformed, non-US or incomplete location is unknown", () => {
  const cases = [
    { country: "CA", visitorState: "BC", visitorCity: "Vancouver", restaurant },
    { country: "US", visitorState: null, visitorCity: "San%20Francisco", restaurant },
    { country: "US", visitorState: "XX", visitorCity: "San%20Francisco", restaurant },
    { country: "US", visitorState: "CA", visitorCity: "%E0%A4%A", restaurant },
    { country: "US", visitorState: "NV", visitorCity: "Las%20Vegas", restaurant: { city: null, state: "CA" } },
    { country: "US", visitorState: "CA", visitorCity: "San%20Francisco", restaurant: { city: "PLACEHOLDER", state: "CA" } },
    { country: "US", visitorState: "CA", visitorCity: "San%20Francisco", restaurant: null },
  ];
  for (const value of cases) assert.equal(classifyVisitorArea(value), "unknown");
});

test("handler resolves only the canonical tenant, returns only the area, and prevents caching", async () => {
  const lookups: string[] = [];
  const handle = createRestaurantGeographyHandler({
    vercel: "1", vercelEnv: "preview",
    async lookupRestaurant(id) { lookups.push(id); return restaurant; },
  });
  const response = await handle(request());
  assert.deepEqual(await response.json(), { visitor_area: "local" });
  assert.deepEqual(lookups, [restaurantId]);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("cdn-cache-control"), "no-store");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "no-store");
  assert.equal(response.headers.get("set-cookie"), null);
});

test("denied or untrusted ingress never looks up a restaurant", async () => {
  for (const config of [
    { vercel: "1", vercelEnv: "preview", country: "FR" },
    { vercel: "0", vercelEnv: "preview", country: "US" },
    { vercel: "1", vercelEnv: "development", country: "US" },
  ]) {
    let lookups = 0;
    const handle = createRestaurantGeographyHandler({
      vercel: config.vercel, vercelEnv: config.vercelEnv,
      async lookupRestaurant() { lookups++; return restaurant; },
    });
    const response = await handle(request(config.country));
    assert.deepEqual(await response.json(), { visitor_area: "unknown" });
    assert.equal(lookups, 0);
  }
});

test("invalid tenant identities, extra client fields and lookup failures return only unknown", async () => {
  const handle = createRestaurantGeographyHandler({ vercel: "1", vercelEnv: "production",
    async lookupRestaurant() { throw new Error("database unavailable"); } });
  for (const body of [{ restaurant_id: "not-a-uuid" }, { restaurant_id: restaurantId, city: "Los Angeles" }, {}]) {
    const response = await handle(request("US", "CA", "San%20Francisco", body));
    assert.deepEqual(await response.json(), { visitor_area: "unknown" });
  }
});

test("only page_view accepts the bounded visitor_area property and geoip remains disabled", () => {
  const base = { analytics_scope: "restaurant", environment: "staging", restaurant_id: restaurantId };
  const page = sanitizeRestaurantCapture({ event: "page_view", properties: { ...base, visitor_area: "same_state" } });
  assert.equal(page?.properties.visitor_area, "same_state");
  assert.equal((page?.properties as Record<string, unknown> | undefined)?.$geoip_disable, true);
  assert.equal(sanitizeRestaurantCapture({ event: "page_view", properties: { ...base, visitor_area: "exact-address" } }), null);
  const interaction = sanitizeRestaurantCapture({ event: "phone_clicked", properties: { ...base, visitor_area: "local" } });
  assert.equal(interaction?.properties.visitor_area, undefined);
  assert.equal((interaction?.properties as Record<string, unknown> | undefined)?.$geoip_disable, true);
});
