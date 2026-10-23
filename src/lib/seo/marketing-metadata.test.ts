import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { createMarketingMetadata, marketingPages, marketingOrganization, marketingService } from "./marketing-metadata";

test("marketing metadata has exact unique titles and Production canonicals even on Preview", () => {
  const titles = ["Restaurant Website Design & Management | Menu Man", "Restaurant Website Design & Pricing | Menu Man", "Restaurant Website Demo | Menu Man", "Get a Restaurant Website | Menu Man", "Cancellation & Data Handoff | Menu Man"];
  const descriptions = new Set<string>();
  Object.keys(marketingPages).forEach((path, index) => {
    const metadata = createMarketingMetadata(path as keyof typeof marketingPages);
    assert.deepEqual(metadata.title, { absolute: titles[index] });
    const canonical = "https://getmenuman.com" + (path === "/" ? "" : path);
    assert.equal(metadata.alternates?.canonical, canonical);
    assert.equal(metadata.openGraph?.url, canonical);
    assert.equal(metadata.openGraph?.title, titles[index]);
    assert.equal(metadata.twitter && "card" in metadata.twitter ? metadata.twitter.card : undefined, "summary");
    assert.equal(new URL(metadata.metadataBase!.toString()).origin, "https://getmenuman.com");
    assert.ok(metadata.description && metadata.description.length <= 170);
    descriptions.add(metadata.description!);
  });
  assert.equal(descriptions.size, titles.length);
});

test("JSON-LD identifies the real organization and the visible service without invented facts", () => {
  const organization = JSON.parse(JSON.stringify(marketingOrganization));
  const service = JSON.parse(JSON.stringify(marketingService));
  assert.equal(organization["@type"], "Organization");
  assert.equal(organization.email, "hello@getmenuman.com");
  assert.ok(existsSync("public" + new URL(organization.logo).pathname));
  assert.equal(service.provider["@id"], organization["@id"]);
  for (const entity of [organization, service]) {
    for (const field of ["address", "aggregateRating", "review", "award", "areaServed"]) assert.equal(entity[field], undefined);
  }
});
