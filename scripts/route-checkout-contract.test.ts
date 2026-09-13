import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("checkout, payment, and confirmation are discrete routes", () => {
  for (const parts of [
    ["src", "app", "r", "[slug]", "checkout", "page.tsx"],
    ["src", "app", "r", "[slug]", "order", "[orderId]", "payment", "page.tsx"],
    ["src", "app", "r", "[slug]", "order", "[orderId]", "confirmation", "page.tsx"],
  ]) assert.equal(existsSync(join(root, ...parts)), true);

  const menu = read("src", "app", "r", "[slug]", "MenuBrowser.tsx");
  assert.doesNotMatch(menu, /<CheckoutPanel/);
  assert.match(menu, /\/checkout/);
});

test("browser payment components never receive the guest checkout capability", () => {
  const checkout = read("src", "app", "r", "[slug]", "CheckoutPanel.tsx");
  const payment = read("src", "app", "r", "[slug]", "PaymentPanel.tsx");
  assert.doesNotMatch(checkout, /checkoutToken/);
  assert.doesNotMatch(payment, /checkoutToken/);

  const cookie = read("src", "lib", "payments", "capability-cookie.ts");
  assert.match(cookie, /httpOnly:\s*true/);
  assert.match(cookie, /sameSite:\s*"lax"/);
});

test("multi-tab messages are advisory and trigger authoritative status fetches", () => {
  const menu = read("src", "app", "r", "[slug]", "MenuBrowser.tsx");
  assert.match(menu, /BroadcastChannel/);
  assert.match(menu, /payment-status/);
  assert.match(menu, /paymentStatusSchema\.parse/);
});

test("staging exceptional-state controls use server routes and retain safe navigation", () => {
  for (const parts of [
    ["src", "app", "api", "orders", "[orderId]", "payments", "fake-authorization", "route.ts"],
    ["src", "app", "api", "orders", "[orderId]", "payments", "fake-late-success", "route.ts"],
  ]) assert.equal(existsSync(join(root, ...parts)), true);

  const payment = read("src", "app", "r", "[slug]", "PaymentPanel.tsx");
  assert.match(payment, /Capture Payment/);
  assert.match(payment, /Void Authorization/);
  assert.match(payment, /Resolve as Accepted \/ Placed/);
  assert.match(payment, /Resolve as Refunded/);
  assert.match(payment, /We&apos;re confirming your order/);
  assert.match(payment, /Please don&apos;t submit another payment while we confirm the order with the restaurant/);
  assert.match(payment, /Back to Checkout Details/);
  assert.match(payment, /href={`\/r\/\$\{restaurantSlug\}\/checkout`}/);
  assert.match(payment, /href={`\/r\/\$\{restaurantSlug\}`}/);
  assert.doesNotMatch(payment, /Edit Cart and Start Fresh/);
  assert.doesNotMatch(payment, /requires restaurant review or a refund/i);
});

test("checkout pickup availability is uncached and stale failures retain the editable cart", () => {
  const availabilityRoute = read(
    "src", "app", "api", "restaurants", "[slug]", "pickup-availability", "route.ts",
  );
  const checkout = read("src", "app", "r", "[slug]", "CheckoutPanel.tsx");
  assert.match(availabilityRoute, /fetchCache\s*=\s*"force-no-store"/);
  assert.match(availabilityRoute, /Cache-Control["']?:\s*"no-store/);
  assert.match(checkout, /resolvePickupSelection\(nextAvailability\)/);
  assert.match(checkout, /isPickupSelectionAvailable/);
  assert.match(checkout, /errorBody\.error\?\.message/);
  assert.doesNotMatch(checkout, /cart\.clear\(/);
});
