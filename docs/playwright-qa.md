# Chrome browser QA

Menu Man's browser QA uses `@playwright/test` with the installed Google Chrome channel. It does not download Chromium. The default target is the Menu Man staging alias; override `PLAYWRIGHT_BASE_URL` only with `http://localhost:3000` or that staging hostname. The Playwright config rejects other hosts so the standard commands cannot target production by accident.

Run the public Super Tacos smoke test at all configured viewports:

```bash
npm run qa:staging
```

Run it with a visible Chrome window, or only at 320px:

```bash
npm run qa:staging:headed
npm run qa:staging:small
```

For a local app, start `npm run dev` and run `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run qa:staging` (PowerShell: `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; npm run qa:staging`). The smoke test visits the Super Tacos home, menu, and location routes; exercises navigation and menu search; captures home/menu screenshots; reports console errors; checks uncaught browser exceptions and horizontal overflow.

Test results, screenshots, traces, and the HTML report are written under `.playwright/`, which is ignored by Git. Open the report with `npx playwright show-report .playwright/html-report`.

## Management pages

For an owner-authorized staging check, open a temporary Chrome session directly on the protected route and sign in manually:

```bash
npm run qa:open:staging
```

Complete the existing staging login in that browser, then inspect the page. The browser context is temporary; close it to discard its cookies. For repeatable local authenticated QA, use only the synthetic roles and ignored storage described below. Never pass credentials on the command line or commit session files.

The standard smoke spec is public-only and does not access management pages, modify data, or submit forms.


## Authenticated management QA

The authenticated management harness uses the installed Chrome channel and a
local application configured for Staging. It requires an explicit localhost
target and never falls back to a Git-linked deployment URL.

## Authenticated staging management QA

The role harness covers two dedicated, synthetic tenants:

| Role | Tenant | Expected access |
| --- | --- | --- |
| `owner` | `menu-man-qa-catering-primary` | Catering inbox and settings |
| `catering-manager` | Primary tenant | Catering inbox and settings |
| `restricted-manager` | Primary tenant | Orders; no Catering access |
| `second-tenant-owner` | `menu-man-qa-catering-secondary` | Its own Catering inbox only |
| `anonymous` | Primary tenant | Redirected to sign-in for management |

The two deterministic tenant fixtures contain no menu, orders, payment records,
or real customer leads. Both have Catering enabled for tenant-isolation checks;
the primary manager grants are explicit, and notification settings are off.
Their restaurant rows set `is_indexable=false`. The SQL fixture script is a
guarded provisioning recipe and is not run automatically by the test harness:
`supabase/qa/provision-authenticated-catering-qa.sql`.

Before any provisioning, request explicit approval for staging writes. With
approval, create four dedicated synthetic Auth users in Menu Man Staging
(`jjvongzvtnzlvwdfcnjk`) using Supabase Dashboard **Create user** with email
confirmed. Do not use Invite user; no invitation/confirmation email is needed.
Use non-deliverable QA addresses and distinct credentials. Replace the four email
placeholders in the SQL recipe and review its fixture-only IDs/slugs. Run the
PowerShell runner first without `-Apply` to verify the local link. To execute the
single fixture script, pass both `-Apply` and the exact Staging reference; the
runner checks `project-ref` and `linked-project.json` and uses only the linked
project query command. It refuses a different reference, missing metadata,
unexpected fixture collisions, or unreplaced account placeholders. It only
inserts the four dedicated memberships, three catering permission overrides, and
two notification-disabled settings rows. It creates no menus, orders, inquiries,
or notification recipients.

```powershell
.\scripts\provision-staging-auth-qa.ps1
.\scripts\provision-staging-auth-qa.ps1 -Apply -ConfirmProjectRef 'jjvongzvtnzlvwdfcnjk'
```

Put the four QA identities and passwords in a local `.env.qa.local` file at the
worktree root. `.env*` is ignored by Git. Never put passwords in command-line
arguments, test source, shell history, logs, screenshots, or issue attachments.
Example keys (fill locally; do not commit this file):

```dotenv
QA_OWNER_EMAIL=
QA_OWNER_PASSWORD=
QA_CATERING_MANAGER_EMAIL=
QA_CATERING_MANAGER_PASSWORD=
QA_RESTRICTED_MANAGER_EMAIL=
QA_RESTRICTED_MANAGER_PASSWORD=
QA_SECOND_TENANT_OWNER_EMAIL=
QA_SECOND_TENANT_OWNER_PASSWORD=
```

Run configuration safety tests without staging credentials:

```powershell
npm run qa:auth:config-test
```

Run one authenticated role spec; Playwright first refreshes that run's role
storage states through the existing `/manage/login` form and Supabase
`signInWithPassword` flow. It reuses a still-valid state and signs in through the
UI again when the saved session expired or is invalid:

```powershell
$env:QA_BASE_URL = 'http://127.0.0.1:3000'
npm run qa:auth -- --project=qa-catering-manager tests/browser/your-check.authenticated.spec.ts
npm run qa:auth:headed -- --project=qa-owner tests/browser/your-check.authenticated.spec.ts
```

For future specs, import `testForRole` from
`tests/browser/authenticated-qa-fixtures.ts` and bind each test to its expected
role. The fixture skips the test in other role projects, preventing an owner
test from silently running with manager credentials. Role storage files are
`.playwright/auth/{role}.json`; these files contain active session tokens and
are excluded from Git with all `.playwright/` output. Recreate them through the
UI setup whenever they expire; never copy them between machines or roles.

Open a saved role session in visible Chrome for visual review. First select the
local app in the same PowerShell session:

```powershell
$env:QA_BASE_URL = 'http://127.0.0.1:3000'
npm run qa:auth:open -- catering-manager
```

This opens the selected local Catering route and waits for the browser window
to close. If the session expired, rerun the authenticated Playwright setup
command for that role first. Do not use the user's personal browser profile.

The browser guard permits only the explicitly selected localhost app, the
Staging Supabase password/refresh/user/logout endpoints and public Staging
media. It blocks the Git-linked Staging URL, other Supabase calls, PostHog
ingestion, Production/unknown origins, and all browser-originated app mutations.
The role smoke tests only read
management pages; they do not submit inquiries, change settings, delete leads,
create orders, send email, or write to a database. Future mutation QA must use
synthetic records, notification-off fixtures, an approved cleanup procedure,
and explicit staging-write authorization.

Do not use this authenticated suite against a Vercel deployment. For a protected
Preview or stable Staging visual check, inspect `/diagnostics` first and confirm
Environment, Branch, Build, and Supabase project reference against the reviewed
deployment commit. It must identify the expected source revision and
`jjvongzvtnzlvwdfcnjk`; stop if either is missing or different. This harness
intentionally has no remote deployment fallback.

### Run against the local staging-backed app

Set QA_BASE_URL to select the local app without changing the fixed Supabase
Auth target. The variable is required. The harness accepts only
http://127.0.0.1:3000 or
http://localhost:3000 for this override; other hosts, ports, and paths fail
closed. Start the local app with Staging-only environment values. The setup
opens `/diagnostics` before any sign-in and fails unless it reports Local and
Supabase project `jjvongzvtnzlvwdfcnjk`. Then run:

```powershell
$env:QA_BASE_URL = 'http://127.0.0.1:3000'
npm run qa:auth
npm run qa:auth
Remove-Item Env:QA_BASE_URL
```

The first run signs in through the local app when no valid role state exists.
The second run prints only role names when it reuses existing sessions. The
browser guard permits app page/API traffic only to that local origin and read
methods. Supabase Auth traffic is pinned to the Staging project origin.
Authenticated server-side page reads use the local application's Staging configuration.
Never put Production credentials in the local environment.

## Validation record

At commit `7a34755` on 2026-10-19, the full authenticated suite passed twice
against the local Staging-backed app at `http://127.0.0.1:3000`. Each run reported 6 passed and
20 skipped; skips are role/test combinations filtered by `testForRole`. The
five active checks covered the owner, catering-enabled manager,
restricted-manager, second-tenant owner, and anonymous roles. The second run
reported reuse of all four authenticated role sessions. Configuration tests
passed 6/6. No inquiry, settings, order, or other restaurant-data mutations
were part of these runs.
