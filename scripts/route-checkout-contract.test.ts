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
