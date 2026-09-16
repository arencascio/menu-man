import assert from "node:assert/strict";
import test from "node:test";
import { claimedNotificationSchema } from "./contracts";
import { isRetryableResendFailure, sendResendEmail } from "./resend";
import { renderNotificationEmail } from "./templates";

const claim = claimedNotificationSchema.parse({
  outboxId: "11111111-1111-4111-8111-111111111111",
  claimToken: "22222222-2222-4222-8222-222222222222",
  attemptNumber: 1,
  notificationType: "customer.order_confirmed",
  recipient: "diner@example.com",
  idempotencyKey: "customer.order_confirmed/33333333-3333-4333-8333-333333333333",
  restaurantName: "Test & Kitchen",
  orderNumber: "1042",
  pickupMode: "scheduled",
  pickupAt: "2026-09-15T19:30:00Z",
  pickupTimezone: "America/Los_Angeles",
  restaurantAddressLine1: "123 Main St",
  restaurantCity: "Los Angeles",
  restaurantState: "CA",
  restaurantPostalCode: "90001",
  googleMapsUrl: "https://maps.google.com/?q=123+Main+St",
  customerEmail: "diner@example.com",
});

test("order confirmation email renders responsive customer pickup details and plain text", () => {
  const email = renderNotificationEmail(claim);
  assert.match(email.subject, /Order #1042 confirmed/);
  assert.match(email.html, /name="viewport"/);
  assert.match(email.html, /MENU MAN/);
  assert.match(email.html, /Test &amp; Kitchen/);
  assert.match(email.html, /123 Main St, Los Angeles, CA 90001/);
  assert.match(email.html, /Get directions/);
  assert.match(email.html, /diner@example\.com/);
  assert.match(email.text, /Pickup mode: Scheduled pickup/);
  assert.match(email.text, /Pickup date & time:/);
  assert.match(email.text, /Directions: https:\/\/maps\.google\.com/);
  assert.doesNotMatch(email.html, /payment token|provider reference|card/i);
});

test("ready-for-pickup email uses the polished customer template", () => {
  const ready = claimedNotificationSchema.parse({
    ...claim,
    notificationType: "customer.ready_for_pickup",
    idempotencyKey: "customer.ready_for_pickup/33333333-3333-4333-8333-333333333333",
  });
  const email = renderNotificationEmail(ready);
  assert.match(email.subject, /ready for pickup/);
  assert.match(email.html, /Your order is ready/);
  assert.match(email.html, /Test &amp; Kitchen/);
  assert.match(email.text, /Email on order: diner@example\.com/);
  assert.doesNotMatch(email.text, /promotion|subscribe|marketing/i);
});

test("Resend delivery sends a stable idempotency key and recognizes success", async () => {
  let request: RequestInit | undefined;
  const result = await sendResendEmail("server-secret", {
    from: "Menu Man <orders@getmenuman.com>", to: claim.recipient,
    subject: "Test", html: "<p>Test</p>", text: "Test",
    idempotencyKey: claim.idempotencyKey,
  }, async (_input, init) => {
    request = init;
    return new Response(JSON.stringify({ id: "resend-message-1" }), { status: 200 });
  });
  assert.equal(new Headers(request?.headers).get("Idempotency-Key"), claim.idempotencyKey);
  assert.equal(result.succeeded, true);
  assert.equal(result.providerMessageId, "resend-message-1");
});

test("Resend retry policy separates transient and permanent failures", async () => {
  assert.equal(isRetryableResendFailure(429, "rate_limit_exceeded"), true);
  assert.equal(isRetryableResendFailure(503, "application_error"), true);
  assert.equal(isRetryableResendFailure(409, "concurrent_idempotent_requests"), true);
  assert.equal(isRetryableResendFailure(409, "invalid_idempotent_request"), false);
  assert.equal(isRetryableResendFailure(422, "validation_error"), false);
  const result = await sendResendEmail("server-secret", {
    from: "from@example.com", to: "to@example.com", subject: "Test",
    html: "Test", text: "Test", idempotencyKey: "test/idempotency",
  }, async () => new Response(JSON.stringify({ name: "validation_error", message: "Bad sender" }), { status: 422 }));
  assert.equal(result.succeeded, false);
  assert.equal(result.retryable, false);
});
