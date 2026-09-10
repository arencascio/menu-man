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
5. Run the SQL files under `supabase/tests/` in filename order.

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
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/001_schema_contract.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/002_checkout_contract.sql
psql $env:MENU_MAN_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/003_armandos_fixture.sql
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
SUPABASE_SERVICE_ROLE_KEY=<the staging service-role key>
```

It refuses to run unless the marker is exactly `staging`, the expected project
ref is present, the configured HTTPS hostname exactly matches that project ref,
and the service-role credential is present. It never prints the credential.

The operational seed deliberately replaces all Armando staging hour rows with
the approved test schedule. Do not apply it to production. The 309 placement
assertion in `003_armandos_fixture.sql` describes this version of
`data/armandos.json`; it is not a database invariant, and the schema supports
placing one canonical item in multiple sections.
