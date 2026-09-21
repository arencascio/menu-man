import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

test("homepage is a menu gateway and the dedicated route owns MenuBrowser", () => {
  const home = source("src", "app", "r", "[slug]", "page.tsx");
  const menu = source("src", "app", "r", "[slug]", "menu", "page.tsx");
  const intro = source("src", "app", "r", "[slug]", "RestaurantMenuIntro.tsx");

  assert.match(home, /<RestaurantMenuIntro\b/);
  assert.doesNotMatch(home, /<MenuBrowser\b/);
  assert.match(home, /primaryAction=\{\{ label: "View the full menu", href: menuHref \}\}/);
  assert.match(home, /getMenuSectionAnchorId\(section\.id\)/);
  assert.match(home, /href: `\$\{menuHref\}#/);
  assert.match(home, /label: "Menu", href: menuHref/);
  assert.match(intro, /primaryAction\?: RestaurantMenuQuicklink/);
  assert.match(menu, /<MenuBrowser\b/);
  assert.match(menu, /getRestaurantMenuSections\(restaurant\.id, menu\.id, true\)/);
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
