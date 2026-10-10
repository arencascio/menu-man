import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getRestaurantNavigation } from "../src/app/r/[slug]/restaurant-navigation-actions";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

test("Armando's homepage has a direct menu gateway and the dedicated route owns MenuBrowser", () => {
  const home = source("src", "app", "r", "[slug]", "page.tsx");
  const menu = source("src", "app", "r", "[slug]", "menu", "page.tsx");
  const menuData = source("src", "app", "r", "[slug]", "restaurant-menu-data.ts");
  assert.match(home, /armandos: \{ orderingActions: false, hoursLocation: false, menuIntro: false \}/);
  assert.ok(home.indexOf("<RestaurantHero") < home.indexOf("<RestaurantAnnouncementStrip"));
  assert.ok(home.indexOf("<RestaurantAnnouncementStrip") < home.indexOf("<RestaurantFeaturedGallerySlider"));
  assert.ok(home.indexOf("<RestaurantFeaturedGallerySlider") < home.indexOf("<RestaurantFooter"));
  assert.doesNotMatch(home, /<MenuBrowser\b/);
  assert.match(home, /href: "\/r\/armandos\/menu"/);
  assert.match(home, /navigation: getRestaurantNavigation/);
  assert.equal(getRestaurantNavigation({ homeHref: "/r/armandos", hasDelivery: false }).find((item) => item.kind !== "delivery" && item.href === "/r/armandos/menu")?.label, "Menu");
  assert.match(menu, /<MenuBrowser\b/);
  assert.match(menu, /getRestaurantMenuSections\(restaurant\.id, menu\.id, true\)/);
  assert.match(menuData, /createMenuModifierGroupResolverFromQueries\(/);
  assert.match(menu, /initialActivePayment=\{initialActivePayment\}/);
});

test("menu route keeps restaurant-scoped ordering state and destination links", () => {
  const browser = source("src", "app", "r", "[slug]", "MenuBrowser.tsx");
  const cart = source("src", "app", "r", "[slug]", "useRestaurantCart.ts");
  const checkout = source("src", "app", "r", "[slug]", "CheckoutPanel.tsx");
  const confirmation = source("src", "app", "r", "[slug]", "order", "[orderId]", "confirmation", "page.tsx");

  assert.match(browser, /getMenuSectionAnchorId\(section\.id\)/);
  assert.match(browser, /useRestaurantCart\(restaurantId, resolvedCurrency\)/);
  assert.match(cart, /loadRestaurantCart\(window\.localStorage, restaurantId, currency\)/);
  assert.match(checkout, /href=\{`\/r\/\$\{restaurantSlug\}\/menu`\}>Back to Menu/);
  assert.match(confirmation, /href=\{`\/r\/\$\{encodeURIComponent\(slug\)\}\/menu`\}>Return to Menu/);
});
