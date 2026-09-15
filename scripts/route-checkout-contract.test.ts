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
  assert.match(menu, /response\.status === 401 \|\| response\.status === 404/);
});

test("safe return-to-menu abandons server-side before navigation", () => {
  const route = read(
    "src", "app", "api", "orders", "[orderId]", "checkout-abandonment", "route.ts",
  );
  const payment = read("src", "app", "r", "[slug]", "PaymentPanel.tsx");
  assert.match(route, /getGuestPaymentCapability/);
  assert.match(route, /abandonCheckout\(orderId, checkoutToken\)/);
  assert.match(route, /clearGuestPaymentCapability/);
  assert.match(payment, /payment\.status === "requires_payment_method"/);
  assert.match(payment, /payment\.latestAttempt === null/);
  assert.match(payment, /checkout-abandonment/);
  assert.match(payment, /if \(!response\.ok\)/);
  assert.match(payment, /broadcastCheckoutEvent\(restaurantId, "payment_changed"\)/);
  assert.match(payment, /router\.push\(`\/r\/\$\{encodeURIComponent\(restaurantSlug\)\}`\)/);
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
  assert.match(checkout, /resolvePickupSelection\(nextAvailability,/);
  assert.match(checkout, /isPickupSelectionAvailable/);
  assert.match(checkout, /errorBody\.error\?\.message/);
  assert.doesNotMatch(checkout, /cart\.clear\(/);
});

test("checkout draft PII is session scoped and cleared only on verified completion", () => {
  const checkout = read("src", "app", "r", "[slug]", "CheckoutPanel.tsx");
  const payment = read("src", "app", "r", "[slug]", "PaymentPanel.tsx");
  const confirmationEffects = read("src", "app", "r", "[slug]", "ConfirmationEffects.tsx");
  const draft = read("src", "lib", "checkout", "draft.ts");
  assert.match(checkout, /loadCheckoutDraft\(window\.sessionStorage/);
  assert.match(checkout, /saveCheckoutDraft\(window\.sessionStorage/);
  assert.doesNotMatch(checkout, /saveCheckoutDraft\(window\.localStorage/);
  assert.match(draft, /CHECKOUT_DRAFT_TTL_MS = 2 \* 60 \* 60 \* 1_000/);
  assert.match(payment, /clearCheckoutDraft\(window\.sessionStorage/);
  assert.match(confirmationEffects, /clearCheckoutDraft\(window\.sessionStorage/);
});

test("pickup snapshots and confirmation status are rendered from the frozen order", () => {
  const snapshot = read("src", "app", "r", "[slug]", "OrderSnapshot.tsx");
  const confirmation = read(
    "src", "app", "r", "[slug]", "order", "[orderId]", "confirmation", "page.tsx",
  );
  const payment = read("src", "app", "r", "[slug]", "PaymentPanel.tsx");
  assert.match(snapshot, /formatPickupDateTime\(order\.pickup\.pickupAt, order\.pickup\.timezone\)/);
  assert.match(snapshot, />Pickup</);
  assert.match(confirmation, /Pickup status/);
  assert.match(confirmation, /Order number/);
  assert.match(confirmation, /confirmationPanel/);
  assert.match(payment, /Confirming your payment&hellip;/);
  assert.doesNotMatch(payment, /provider confirms it/i);
});

test("payment and confirmation keep receipt totals without duplicate headline totals or developer copy", () => {
  const snapshot = read("src", "app", "r", "[slug]", "OrderSnapshot.tsx");
  const payment = read("src", "app", "r", "[slug]", "PaymentPanel.tsx");
  const styles = read("src", "app", "r", "[slug]", "menu-browser.module.css");
  assert.match(snapshot, /<dt>Total<\/dt>/);
  assert.doesNotMatch(snapshot, /confirmationTotal/);
  assert.doesNotMatch(payment, /This total is frozen from the authoritative order snapshot/);
  assert.doesNotMatch(styles, /\.confirmationTotal/);
});

test("Square card readiness is presentation-only and never submits a client total", () => {
  const square = read("src", "app", "r", "[slug]", "SquarePaymentForm.tsx");
  assert.match(square, /isCompletelyValid/);
  assert.match(square, /squareCardContainerComplete/);
  assert.match(square, /disabled=\{!cardReady \|\| !cardComplete \|\| submitting\}/);
  assert.doesNotMatch(square, /onToken\([^)]*amountCents/);
});

test("restaurant server components pass serializable analytics data to a client link boundary", () => {
  const hero = read("src", "app", "r", "[slug]", "RestaurantHero.tsx");
  const info = read("src", "app", "r", "[slug]", "RestaurantInfo.tsx");
  const trackedLink = read("src", "app", "r", "[slug]", "TrackedRestaurantLink.tsx");

  for (const serverComponent of [hero, info]) {
    assert.doesNotMatch(serverComponent, /onClick=/);
    assert.doesNotMatch(serverComponent, /@\/lib\/analytics\/client/);
    assert.match(serverComponent, /TrackedRestaurantLink/);
  }

  assert.match(trackedLink, /^"use client";/);
  assert.match(trackedLink, /onClick=\{\(\) => trackEvent\(\{ name: eventName, restaurantId \}\)\}/);
  assert.match(trackedLink, /target=\{target\}/);
  assert.match(trackedLink, /rel=\{rel\}/);
});
