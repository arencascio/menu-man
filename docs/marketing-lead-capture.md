# Marketing lead capture

Build My Website and Free Website Review submit to `POST /api/marketing/leads`.
The endpoint reuses the existing Resend HTTP email utility, independently of the
restaurant notification worker and Supabase. Restaurant nominations are temporarily
removed. No new dependency, database table, queue, or migration is needed.

## Required configuration

Set these **server-only** values in the environment that runs Next.js:

- `RESEND_API_KEY`: a Resend API key allowed to send from the verified domain.
  The existing key can be reused if its permissions/domain are appropriate.
- `MENU_MAN_LEAD_EMAIL_FROM`: a verified sender, for example
  `Menu Man <hello@getmenuman.com>` after verifying `getmenuman.com` in Resend.

Neither value uses a `NEXT_PUBLIC_` prefix. The recipient is fixed in code to
`hello@getmenuman.com`; it cannot be supplied in a submission. The sender and
subjects are also never taken from user input. The validated prospect email is
used as Reply-To and appears in the message body; it is not used as From or To.
Existing order emails omit Reply-To and retain their previous behavior.

If the sending domain is not already verified, add exactly the DKIM and SPF /
sending-domain records shown by Resend and wait for its verified status. Add or
review DMARC according to the domain's existing policy. Preserve the mailbox's
existing inbound MX configuration; sending-domain verification does not create
or verify the `hello@` inbox. Confirm that mailbox independently. Never put API
keys in screenshots, source control, browser code, or test fixtures.

## Safeguards and limits

- Strict server schema: required restaurant/email and request context; bounded
  fields, HTTP(S) website URLs, and a maximum 16 KiB streamed request body.
- Same-origin browser requests, an offscreen honeypot, and five attempts per
  source per 15 minutes per running process. On Vercel the source uses its
  platform forwarded-IP header; elsewhere configure a trusted proxy to supply
  `x-forwarded-for`. Missing IPs share one bucket. No raw IP or lead logging.
- Provider calls time out after 10 seconds. Provider failures/missing configuration
  return explicit errors, never a successful submission. No auto-retry worker.
- Synchronous client lock plus disabled fields while sending. Retries with
  unchanged values retain their submission UUID and Resend idempotency key;
  changed values get a new key. Resend's deduplication window is 24 hours.
- Fields stay mounted after failures. The error provides a prefilled `mailto:`
  fallback. Very long mailto bodies may exceed a mail client's URL limits; the
  visible address and retained form details remain available for manual email.
- Provider acceptance is not proof of final inbox delivery. A timeout can be
  ambiguous; retry unchanged details before creating a separate email inquiry.
- Local rate limits reset on cold starts and are not shared across instances.
  Origin/honeypot checks do not stop determined bots. Use platform-level rate
  limiting if spam warrants it; no distributed infrastructure or CAPTCHA is
  introduced here. Refreshing the page loses the in-memory submission identity.

## Validation without sending email

```powershell
node --import=tsx src/lib/marketing-leads/leads.test.ts
npx tsc --noEmit
npm run lint
```

The focused tests use mocked fetch responses only. They cover both request types,
fixed recipients, escaping, missing configuration, failed/invalid acceptance,
validation, abuse limits, duplicate clicks/retry identity, retained values, and
fallback details. They do not establish inbox delivery or physical-device behavior.

## Real end-to-end test before deployment

Do this only with separate explicit authorization to send real test emails.

1. Configure the verified sender and key privately in an isolated local session
   or an already available non-production environment. Start Next.js there and
   open its actual origin. Do not use the live production site to test unreleased code.
2. Submit one clearly labeled TEST website inquiry using contact details you
   control; leave phone blank. Confirm the sending state and disabled inputs,
   then the accepted confirmation. In Resend, verify acceptance and delivery;
   in `hello@getmenuman.com`, confirm receipt, request type, and every entered
   field. Inspect the message headers: From must match the configured sender,
   To must remain `hello@getmenuman.com`, and Reply-To must match your submitted
   test contact address. Open Reply and confirm it targets that contact address,
   not the Menu Man sender. Do not send the reply unless separately authorized.
   Do not infer receipt from the UI alone.
3. Submit one TEST review request with a website, and a second with no website.
   Verify both reach the same inbox with distinct review subjects/context, and
   repeat the Reply-To/header and Reply-destination checks for each.
4. In that non-production session, remove the sender configuration and restart.
   Submit a test: expect an actionable error, unchanged field values, no success,
   and a prefilled fallback containing the details. Do not activate the mailto
   action unless an additional email is intended. Restore the configuration.
5. Using a mocked/delayed provider in automated tests, verify double-clicks issue
   one request and failed retries reuse the same key. If manually exercising an
   ambiguous response, keep the payload/UUID unchanged and confirm Resend reports
   only one email for that key. Never add provider failure switches to production.
6. Check both forms at 320px, 412px, and desktop widths, including keyboard access,
   validation, errors, and review-modal close/reopen behavior. Any additional real
   successful submissions send emails and need to remain within the test authorization.

This implementation does not deploy, configure DNS, activate credentials, or send
test messages automatically. Provision those settings and perform the authorized
receipt test before treating the lead-delivery launch blocker as operationally closed.
