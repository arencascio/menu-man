import test from "node:test";
import assert from "node:assert/strict";
import { isUpperCrustConceptPage, upperCrustLocalAllowed } from "./access";
import { isUpperCrustReferenceAsset, isUpperCrustReferencePath } from "./reference-media";

test("private prospect concept fails closed outside an opted-in staging loopback process", () => {
  const env = { MENU_MAN_UPPER_CRUST_LOCAL: "true", MENU_MAN_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: "https://jjvongzvtnzlvwdfcnjk.supabase.co" };
  assert.equal(upperCrustLocalAllowed(env, "127.0.0.1:3212"), true);
  assert.equal(upperCrustLocalAllowed(env, "localhost:3212"), true);
  for (const host of ["", "example.com", "localhost.example.com", "127.0.0.1.evil.test", "localhost@evil.test", "192.168.1.145:3212"]) assert.equal(upperCrustLocalAllowed(env, host), false);
  for (const patch of [
    { MENU_MAN_UPPER_CRUST_LOCAL: undefined }, { MENU_MAN_ENV: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://fullaiodvmilkdxyxnln.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://jjvongzvtnzlvwdfcnjk.supabase.co.evil.test" },
    { VERCEL: "1" }, { VERCEL_ENV: "preview" }, { VERCEL_ENV: "production" },
  ]) assert.equal(upperCrustLocalAllowed({ ...env, ...patch }, "localhost:3212"), false);
});

test("only implemented private concept pages pass the route allowlist", () => {
  for (const suffix of ["", "/menu", "/checkout", "/about", "/catering"]) assert.equal(isUpperCrustConceptPage(`/r/upper-crust${suffix}`), true);
  for (const pathname of ["/r/upper-crust/location", "/r/upper-crust/directions", "/r/upper-crust/about/fake", "/api/restaurants/upper-crust/orders"]) assert.equal(isUpperCrustConceptPage(pathname), false);
});

test("local reference media accepts only named files and rejects traversal and prototype keys", () => {
  for (const name of ["front.jpg", "front-door.jpg", "hanging-sign.jpg", "patio.jpg", "dining.jpg", "takeaway.jpg", "desserts.jpg"]) {
    assert.equal(isUpperCrustReferenceAsset(name), true);
    assert.equal(isUpperCrustReferencePath(`/r/upper-crust/reference-media/${name}`), true);
  }
  for (const name of ["../.env", "%2e%2e%2f.env", "__proto__", "toString", "unknown.jpg", "storefront.jpg", "front.jpg/extra"]) {
    assert.equal(isUpperCrustReferenceAsset(name), false);
    assert.equal(isUpperCrustReferencePath(`/r/upper-crust/reference-media/${name}`), false);
  }
});
