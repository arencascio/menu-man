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
});

test("customer operational email contains only concise order and pickup context", () => {
  const email = renderNotificationEmail(claim);
  assert.match(email.subject, /Order #1042 confirmed/);
  assert.match(email.html, /Test &amp; Kitchen/);
  assert.match(email.text, /Pickup:/);
  assert.doesNotMatch(email.html, /payment token|provider reference|card/i);
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
