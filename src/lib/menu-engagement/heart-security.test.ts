import assert from "node:assert/strict";
import { test } from "node:test";
import { createHeartLimiter, heartCookieFrom, heartOriginAllowed, heartSource, heartTargetStatus, heartVisitor, heartVoteAllowed, recentItemLimit } from "./heart-security";

const secret = "server-only-test-secret";
const restaurant = "restaurant-a";
const item = "item-a";

test("anonymous visitor receives a signed identity that survives later browsing", () => {
  const first = heartVisitor(undefined, secret);
  assert.equal(first.fresh, true);
  const request = new Request("https://example.test/hearts", { headers: { cookie: `mm_visitor=${first.cookie}` } });
  const later = heartVisitor(heartCookieFrom(request), secret);
  assert.equal(later.fresh, false);
  assert.equal(later.key, first.key);
});

test("chosen UUID, malformed cookie, and altered signature cannot assume an existing visitor", () => {
  const issued = heartVisitor(undefined, secret);
  const chosen = "00000000-0000-4000-8000-000000000001";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const last = issued.cookie.at(-1) ?? "";
  const noncanonical = `${issued.cookie.slice(0, -1)}${alphabet[alphabet.indexOf(last) + 1]}`;
  const penultimate = issued.cookie.at(-2) ?? "";
  const altered = `${issued.cookie.slice(0, -2)}${penultimate === "A" ? "B" : "A"}${last}`;
  for (const value of [chosen, "garbage", altered, noncanonical]) {
    const replacement = heartVisitor(value, secret);
    assert.equal(replacement.fresh, true);
    assert.notEqual(replacement.key, issued.key);
    assert.notEqual(replacement.cookie, value);
  }
});

test("new heart attempts are bounded per visitor and per trusted source without blocking unlikes or duplicate votes", () => {
  const allow = createHeartLimiter(() => 1_000);
  const votes = new Set<string>();
  const heart = (visitor: string, liked: boolean, source: string | null) => {
    const key = `${visitor}:${restaurant}:${item}`;
    const permitted = heartVoteAllowed({ liked, existing: votes.has(key), recent: votes.size,
      visitorKey: visitor, sourceKey: source, restaurantId: restaurant, itemId: item }, allow);
    if (!permitted) return false;
    if (!liked) { votes.delete(key); return true; }
    votes.add(key);
    return true;
  };
  assert.equal(heart("normal", true, "shared"), true);
  assert.equal(heart("normal", true, "shared"), true);
  assert.equal(votes.size, 1);
  assert.equal(heart("normal", false, "shared"), true);
  assert.equal(votes.size, 0);
  for (let index = 0; index < 19; index++) assert.equal(heart(`visitor-${index}`, true, "shared"), true);
  assert.equal(heart("attacker", true, "shared"), false);
  assert.equal(heart("other-source", true, "different"), true);
});

test("recent item cap limits new votes while preserving duplicate and unlike behavior", () => {
  const base = { visitorKey: "visitor", sourceKey: null, restaurantId: restaurant, itemId: item, recent: recentItemLimit };
  const allow = () => true;
  assert.equal(heartVoteAllowed({ ...base, liked: true, existing: false }, allow), false);
  assert.equal(heartVoteAllowed({ ...base, liked: true, existing: true }, allow), true);
  assert.equal(heartVoteAllowed({ ...base, liked: false, existing: true }, allow), true);
});

test("cross-origin and absent-origin mutations fail the route's origin policy", () => {
  const url = "https://staging.example.test/api/restaurants/a/hearts";
  assert.equal(heartOriginAllowed(new Request(url, { headers: { origin: "https://staging.example.test" } })), true);
  assert.equal(heartOriginAllowed(new Request(url, { headers: { origin: "https://attacker.test" } })), false);
  assert.equal(heartOriginAllowed(new Request(url)), false);
});

test("a foreign restaurant item never becomes a valid heart target", async () => {
  const menus = new Map([["restaurant-a", "menu-a"], ["restaurant-b", "menu-b"]]);
  const placements = new Set(["menu-a:item-a", "menu-b:item-b"]);
  const findMenu = async (id: string) => menus.get(id) ?? null;
  const hasPlacement = async (menuId: string, itemId: string) => placements.has(`${menuId}:${itemId}`);
  assert.equal(await heartTargetStatus("restaurant-a", "item-a", findMenu, hasPlacement), "valid");
  assert.equal(await heartTargetStatus("restaurant-a", "item-b", findMenu, hasPlacement), "no-item");
  assert.equal(await heartTargetStatus("restaurant-missing", "item-a", findMenu, hasPlacement), "no-menu");
});

test("source throttling uses only a valid Vercel edge IP and stores its digest", () => {
  const request = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.2" } });
  assert.equal(heartSource(request, secret, undefined), null);
  const source = heartSource(request, secret, "preview");
  assert.match(source ?? "", /^[a-f0-9]{64}$/);
  assert.ok(!source?.includes("203.0.113.2"));
});
