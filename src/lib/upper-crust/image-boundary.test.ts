import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { hasLocalMatch } from "next/dist/shared/lib/match-local-pattern";
import config from "../../../next.config";

test("optimizer source patterns exclude protected restaurant routes and encoded variants", () => {
  const patterns = config.images?.localPatterns;
  assert.ok(patterns?.length);
  for (const path of [
    "/r/upper-crust/media/upper-crust.png",
    "/r/upper-crust/media/veggie%20sandwich.jpg",
    "/r/upper-crust/media/veggie%2520sandwich.jpg",
    "/r/upper-crust/reference-media/front.jpg",
    "/r%2fupper-crust%2fmedia%2fblt.jpg",
    "/img/../r/upper-crust/media/blt.jpg",
    "/api/restaurants/upper-crust/media/blt.jpg",
  ]) assert.equal(hasLocalMatch(patterns, path), false, path);
});

test("optimizer patterns preserve every existing public image and Next static imports", () => {
  const images = readdirSync("public", { recursive: true, encoding: "utf8" })
    .filter(file => /\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/i.test(file));
  assert.ok(images.length);
  for (const file of images) assert.equal(hasLocalMatch(config.images?.localPatterns, `/${file.replaceAll("\\", "/")}`), true, file);
  assert.equal(hasLocalMatch(config.images?.localPatterns, "/_next/static/media/example.123.png"), true);
});
