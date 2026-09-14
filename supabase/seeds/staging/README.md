# Armando staging seed

These files contain staging-only test data. They are intentionally outside
`supabase/seed.sql`, so normal migration or production deployment commands do
not apply them automatically.

Run the sequence only against the separately created staging project:

1. Apply `001_armandos_restaurant.sql`.
2. Run the repository's `data/armandos.json` importer with
   `npm run import-menu:staging`.
3. Apply `002_armandos_operations.sql`.
4. Apply `003_armandos_test_modifiers.sql`.
5. Apply `004_armandos_fake_payments.sql`.
6. To route Armando's to Square Sandbox, apply `005_armandos_square_sandbox.sql`
   with the fixed Sandbox merchant and location IDs.
7. Run the SQL files under `supabase/tests/` in filename order. The fake
   contract temporarily selects the fake route inside its rolled-back
   transaction; the Square contract uses the selected Square route.
8. After the order-management migration is applied, invite and bootstrap the
   first owner with the guarded staging command below. Then run `007` and `008`.

One explicit hosted-staging command sequence is:

```powershell
npx supabase login
npx supabase link --project-ref <staging-project-ref>
npx supabase db push --dry-run
npx supabase db push

$env:MENU_MAN_STAGING_DATABASE_URL = '<staging-postgres-connection-string>'
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/seeds/staging/001_armandos_restaurant.sql
npm run import-menu:staging -- --file ./data/armandos.json --dry-run
npm run import-menu:staging -- --file ./data/armandos.json
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/seeds/staging/002_armandos_operations.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/seeds/staging/003_armandos_test_modifiers.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/seeds/staging/004_armandos_fake_payments.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -v menu_man_environment=staging -v square_merchant_id='<sandbox-merchant-id>' -v square_location_id='<sandbox-location-id>' -f supabase/seeds/staging/005_armandos_square_sandbox.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/001_schema_contract.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/002_checkout_contract.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/003_armandos_fixture.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/004_payments_contract.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/005_square_payments_contract.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/006_pickup_availability_contract.sql
npm run bootstrap-owner:staging -- --restaurant armandos --email '<owner-email>' --display-name '<owner-name>' --app-origin 'https://<preview-host>'
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/007_order_management_contract.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/008_restaurant_user_management_contract.sql
```

Before `db push`, confirm the linked project printed by the CLI is the new
staging project. Do not use `db reset --linked`; it is destructive. The
PostgreSQL connection string must be percent-encoded where required by its
client and should never be committed.

The staging importer requires `.env.staging.local` to contain all of:

```text
MENU_MAN_ENV=staging
MENU_MAN_STAGING_PROJECT_REF=<the intended staging project ref>
NEXT_PUBLIC_SUPABASE_URL=https://<the intended staging project ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<the staging service-role key>
MENU_MAN_ENABLE_FAKE_PAYMENTS=true
MENU_MAN_FAKE_WEBHOOK_SECRET=<at-least-32-random-characters>
MENU_MAN_ENABLE_SQUARE_SANDBOX=true
SQUARE_API_VERSION=2026-08-19
SQUARE_SANDBOX_APPLICATION_ID=<sandbox-application-id>
SQUARE_SANDBOX_ACCESS_TOKEN=<sandbox-access-token>
SQUARE_SANDBOX_MERCHANT_ID=<sandbox-merchant-id>
SQUARE_SANDBOX_LOCATION_ID=<sandbox-location-id>
SQUARE_SANDBOX_WEBHOOK_SIGNATURE_KEY=<sandbox-webhook-signature-key>
SQUARE_SANDBOX_WEBHOOK_NOTIFICATION_URL=https://<preview-host>/api/webhooks/payments/square/sandbox
```

In Supabase Authentication settings, disable public user signups, set the Site
URL to the Preview deployment, and allow the Preview callback URL. The
publishable key is intentionally browser-safe; the service-role key remains a
server-only secret. The bootstrap command validates the staging project host,
creates the Auth invitation, then uses the restricted one-time owner RPC. It
does not print credentials or invitation tokens.

For the server-rendered invitation callback, configure the Supabase **Invite
user** email template link as follows (the application-supplied RedirectTo
already contains the reset-password destination):

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite">Accept invitation</a>
```

Keep every Preview `/auth/callback` URL used for invitations in the Auth
redirect allow list. The callback verifies the token hash server-side, marks
pending restaurant memberships active, and then sends the invitee to choose a
password. Do not use the default fragment-session invite link with this SSR
flow.

The fake provider is rejected when `MENU_MAN_ENV=production`, requires the
explicit enable flag and signing secret, and only accepts database connections
whose environment is `test`.

The Square adapter is likewise disabled for `MENU_MAN_ENV=production` and
requires its explicit Sandbox enable flag. Only the application ID and
location ID are returned to the browser. The Sandbox access token and webhook
signature key remain server-side Vercel secrets and are not stored in the
database seed.

It refuses to run unless the marker is exactly `staging`, the expected project
ref is present, the configured HTTPS hostname exactly matches that project ref,
and the service-role credential is present. It never prints the credential.

The operational seed deliberately replaces all Armando staging hour rows with
the approved test schedule. Do not apply it to production. The 309 placement
assertion in `003_armandos_fixture.sql` describes this version of
`data/armandos.json`; it is not a database invariant, and the schema supports
placing one canonical item in multiple sections.
