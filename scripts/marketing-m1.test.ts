import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PUBLIC_PRICING, includedServices, optionalServices, processSteps, productFeatures } from "../src/app/marketing-content";
import { getShowcaseHref, restaurantShowcases } from "../src/lib/restaurant-showcases";
import "../src/lib/analytics/marketing.test";
import "../src/lib/marketing-leads/leads.test";

test("M.1 preserves monthly/add-on prices and separately publishes the approved startup fee", () => {
  assert.equal(PUBLIC_PRICING.monthly, "$99/month");
  assert.equal(PUBLIC_PRICING.startupFee, "$300");
  assert.equal(PUBLIC_PRICING.deliveryFirstPlatform, "$25/month");
  assert.equal(PUBLIC_PRICING.pickupPerOrder, "$0.50");
  assert.equal(includedServices.length, 10);
  assert.ok(!includedServices.some((service) => /pickup ordering/.test(service)));
  assert.equal(optionalServices[1].title, "Menu Man pickup ordering");
  assert.equal(productFeatures.slice(0, 3).length, 3);
  assert.equal(processSteps.length, 3);
});

test("finalized logos match the owner source hashes and contain no executable, remote or raster content", () => {
  const manifest = JSON.parse(readFileSync("public/brand/menu-man-svg-sources.json", "utf8"));
  for (const asset of manifest.assets) {
    const svg = readFileSync(`public/brand/${asset.file}`, "utf8");
    assert.equal(createHash("sha256").update(svg).digest("hex"), asset.sha256);
    assert.ok(!/<\s*(?:image|script|foreignObject|iframe)\b|(?:href|src)\s*=|url\s*\(|\son\w+\s*=|<!ENTITY|<!DOCTYPE/i.test(svg));
  }
  for (const file of ["src/app/MarketingComponents.tsx", "src/app/page.tsx", "src/app/work/page.tsx"]) {
    assert.ok(!readFileSync(file, "utf8").includes("menu-man-phone.png"));
  }
  assert.ok(readFileSync("src/app/MarketingComponents.tsx", "utf8").includes("/brand/MenuManPhoneSmol.svg"));
  const preview = JSON.parse(readFileSync("public/brand/previews/sources.json", "utf8"));
  assert.equal(createHash("sha256").update(readFileSync(`public/brand/previews/${preview.file}`)).digest("hex"), preview.sha256);
});

test("only the approved Super Tacos showcase appears in marketing and cancellation has a working link", () => {
  assert.equal(restaurantShowcases.length, 1);
  assert.equal(restaurantShowcases[0].slug, "super-tacos");
  for (const showcase of restaurantShowcases) assert.equal(getShowcaseHref(showcase), "/r/super-tacos");
  for (const file of ["src/app/page.tsx", "src/app/work/page.tsx", "src/app/RestaurantShowcases.tsx", "src/lib/restaurant-showcases.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /armandos|armando's|two restaurant personalities|different restaurants, distinct personalities/i);
  }
  const services = readFileSync("src/app/services/page.tsx", "utf8");
  assert.match(services, /<Link href=\{cancellationHref \?\? "\/cancellation"\}>What happens if I cancel\?/);
});
