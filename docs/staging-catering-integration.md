# Catering V1 Staging integration

Prepared 2026-10-19 on `integration/staging-catering-v1`, based on the confirmed
`origin/staging` revision `1b38fcdf222a43845b3120331ca3dda254ac6305`.
This is a local integration checkpoint. It does not authorize a push,
deployment, migration, fixture provisioning, email, or Production operation.

## Source scope

The implementation selectively ports the Catering runtime and regression tests
from `a22106e`, the management account bar from `4c41cd1`, and authenticated QA
from `7a34755`. It also carries the previously reviewed local QA target safeguards:
an explicit localhost target, a Staging diagnostics check before sign-in, and
the headed entry point using the selected target.

The divergent marketing/analytics release ancestry was not merged. The existing
Staging analytics report form, reporting backend, captured-sales reporting,
visitor identity, geographic eligibility, GA4 isolation, marketing flows, cart,
and restaurant fixtures are preserved. Only bounded Catering event names and
page classification were added to the existing restaurant analytics schema.

Included application changes:

- Optional `/r/[slug]/catering`, configurable presentation, disabled-by-default
  navigation, validated inquiry form and request confirmation.
- Tenant-scoped management APIs, inbox pagination/status changes, owner-only
  deletion with typed confirmation, and Catering settings.
- The known `manage_catering` capability in membership/team contracts and UI.
  Unknown permissions remain rejected; no filtering or replacement framework
  was introduced.
- Existing Resend integration for optional owner notices, without customer
  details in email or analytics. Missing/failed notices preserve saved leads.
- Shared account identity/role/Sign out layout, with duplicate page controls
  removed while retaining each page's authorization handling.
- Catering's reviewed Preview canonical/noindex protections, fail-closed
  sitemap behavior, and their tests. Marketing content and analytics stay intact.

No dependency or lockfile change is needed: Staging already has Playwright.
The optional component-fixture bundler and its direct `esbuild` dependency were
omitted. Historical Production upgrade plans and unrelated QA artifacts were
not imported.

## Existing schema dependencies

Staging's migration source already supplies:

- `202609140001_order_management_foundation.sql`: memberships, capabilities,
  role defaults and `private.require_restaurant_capability_v1`.
- `202609140003_restaurant_user_management.sql`: existing team lifecycle and
  permission writes, whose contracts now explicitly include Catering.
- `202609150001_notifications_multitenant.sql`: notification settings,
  `restaurants.is_indexable`, and the existing email foundation.
- `202609170001_restaurant_settings_v1.sql`: existing management settings.

The two reviewed Catering migrations `202610190001` and `202610190002` are copied
unchanged for source/history completeness. They are already installed in shared
Staging according to the confirmed task state. **Do not reapply, repair history,
or run a blanket database push.** No SQL was executed during this integration.

Their Git blob hashes match `a22106e` exactly:

| Migration | Git blob |
| --- | --- |
| `202610190001` | `6a8fa37a2d0361f80a260b716befeaa7e7ab415f` |
| `202610190002` | `dcf4e20c60a563a73e44c2cb328c3bc9653a7d05` |

The migrations retain RLS and direct-access revocations, authenticated
tenant/capability checks, service-role-only public submission RPC access,
durable quotas and exact-retry handling. Owner deletion retains a tenant-scoped
tombstone and shares the submission lock to prevent recreation. Retention is
manual; no automatic deletion policy was added. Existing five Test Kitchen
tombstones and all shared database configuration were untouched.

## Actual integration resolutions

- `ManagementNav`: retain Staging's optional `memberRole` contract and add the
  Catering tab/capability.
- Analytics page: remove its duplicate Sign out form and retain Staging's
  current GET range selector and dashboard. Do not import the other branch's
  range-control implementation.
- Shared CSS: retain Staging's wrapping navigation and add account-bar styles.
- Browser fixtures: preserve the public `fixtures.ts`; put the authenticated
  guard in `authenticated-guard-fixtures.ts`. Exclude authenticated specs from
  the public config so neither suite runs the other's test cases.
- Two existing Staging analytics tests failed identically on unchanged
  `origin/staging`. Their eligibility mocks lacked `restaurantArea`, and the
  action test asserted before asynchronous page-view capture. Only those mocks
  and the wait were corrected. The runtime analytics implementation is unchanged.

## Validation

- Catering/deletion/SEO/account-bar checks: **51/51 passed**.
- Authenticated QA configuration checks: **6/6 passed**.
- Full offline regression runner: **389/389 passed**.
- Next route type generation, TypeScript checking, targeted lint, and diff checks
  passed.
- Build is **not verified**. Normal Turbopack stopped because dependencies are
  installed above this new worktree and outside its resolution root. One retry
  with Webpack failed on the unchanged Staging selector at
  `src/app/r/[slug]/restaurant-delivery-chooser.module.css:95` (a global selector
  is not pure under Webpack CSS Modules). No unrelated CSS/configuration changes
  or dependency installation were made to work around this. Use a normal
  worktree-local locked dependency installation and run the standard Turbopack
  build before promotion.
- Public browser discovery preserves **12 tests in 3 files** across desktop,
  mobile and small-mobile. Authenticated discovery lists the expected **26
  setup/role combinations in 2 files**. Listing used dummy configuration and did
  not launch Chrome, authenticate, or contact Supabase.
- Live authenticated/browser QA was not rerun against this integration. The
  earlier two full authenticated runs at `7a34755` remain prior-source evidence.

All new regression tests are offline. No actual database transaction, RPC,
email, payment, order, inquiry, or fixture mutation occurred. Build validation
uses an invalid placeholder Supabase host and keys, never real credentials.

## Before promotion to origin/staging

1. Review the exact diff from `1b38fcd` and this source checkpoint, including the
   unchanged Catering migration hashes and the intentionally retained Staging
   analytics behavior. Check the remote has not advanced since the base. Complete
   a normal Turbopack build with dependencies installed in this worktree.
2. With normal synthetic Auth activity authorized, run the authenticated suite
   twice against this integration's local Staging-backed app. Verify the shared
   account bar and Catering/Analytics/Settings/Orders/Team at mobile and desktop
   widths. Do not provision fixtures, enable existing restaurants, or submit
   inquiries as part of read-only smoke QA.
3. Obtain the separate push/integration approval. Let the confirmed Vercel Git
   workflow deploy the approved `staging` revision, or obtain separate approval
   for an isolated protected Preview. Verify diagnostics against the intended
   source revision and Supabase Staging `jjvongzvtnzlvwdfcnjk`.
4. Keep Production (`fullaiodvmilkdxyxnln`) under its separate source/schema
   review and explicit execution approval. This Staging integration does not
   resolve or import a Production legacy-schema upgrade.
