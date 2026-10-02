import assert from "node:assert/strict";
import test from "node:test";
import { checkoutSource } from "./source";

function request(headers: Record<string, string>) {
  return new Request("https://preview.example.test/api/restaurants/a/orders", { headers });
}

test("checkout source trusts only Vercel's normalized header in deployed environments", () => {
  const original = checkoutSource(request({ "x-vercel-forwarded-for": "203.0.113.2" }), "a", "secret", "preview");
  assert.match(original!, /^[0-9a-f]{64}$/);
  assert.equal(checkoutSource(request({
    "x-vercel-forwarded-for": "203.0.113.2",
    "x-forwarded-for": "198.51.100.4",
    "x-real-ip": "198.51.100.5",
  }), "a", "secret", "preview"), original);
  assert.notEqual(checkoutSource(request({ "x-vercel-forwarded-for": "203.0.113.3" }), "a", "secret", "preview"), original);
  assert.notEqual(checkoutSource(request({ "x-vercel-forwarded-for": "203.0.113.2" }), "b", "secret", "preview"), original);
  assert.equal(checkoutSource(request({ "x-forwarded-for": "203.0.113.2" }), "a", "secret", "preview"), null);
  assert.equal(checkoutSource(request({ "x-vercel-forwarded-for": "bad" }), "a", "secret", "preview"), null);
  assert.equal(checkoutSource(request({ "x-vercel-forwarded-for": "203.0.113.2" }), "a", "secret", "production"), original);
});

test("local and test checkout source does not trust caller-supplied forwarding headers", () => {
  const forwarded = request({ "x-vercel-forwarded-for": "203.0.113.2" });
  assert.equal(checkoutSource(forwarded, "a", "secret", "development"), null);
  assert.equal(checkoutSource(forwarded, "a", "secret", "test"), null);
  assert.equal(checkoutSource(forwarded, "a", undefined, "preview"), null);
});
