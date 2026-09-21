import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

test("restaurant location page composes the shared shell, hours data, and footer", () => {
  const route = source("src", "app", "r", "[slug]", "location", "page.tsx");
  const home = source("src", "app", "r", "[slug]", "page.tsx");
  const hoursData = source("src", "app", "r", "[slug]", "restaurant-location-data.ts");

  for (const component of ["RestaurantShell", "RestaurantAbout", "RestaurantHoursLocation", "RestaurantMapViews", "RestaurantFooter"]) {
    assert.match(route, new RegExp(`<${component}\\b`));
  }
  assert.match(route, /getRestaurantHoursLocationData\(restaurant\.id, restaurant\.timezone\)/);
  assert.match(home, /getRestaurantHoursLocationData\(restaurant\.id, restaurant\.timezone\)/);
  assert.match(hoursData, /\.from\("restaurant_business_hours"\)/);
  assert.match(hoursData, /\.from\("restaurant_special_hours"\)/);
  assert.match(home, /label: "Location", href: `\/r\/\$\{restaurant\.slug\}\/location`/);
  assert.match(route, /label: "Menu", href: `\$\{homeHref\}\/menu`/);
});

test("Armando's map and storefront embeds are configured outside the shared presentation", () => {
  const presentation = source("src", "app", "r", "[slug]", "restaurant-location-presentation.ts");
  const map = source("src", "app", "r", "[slug]", "RestaurantMapViews.tsx");
  const about = source("src", "app", "r", "[slug]", "RestaurantAbout.tsx");

  assert.match(presentation, /armandos: \{/);
  assert.match(presentation, /mapEmbedUrl: "https:\/\/www\.google\.com\/maps\/embed\?pb=/);
  assert.match(presentation, /streetViewEmbedUrl: "https:\/\/www\.google\.com\/maps\/embed\?pb=/);
  assert.doesNotMatch(map, /Armando/);
  assert.doesNotMatch(about, /Armando/);
  assert.match(map, /loading="lazy"/);
  assert.match(map, /referrerPolicy="strict-origin-when-cross-origin"/);
  assert.match(map, /if \(!mapUrl && !streetViewUrl\) return null/);
});
