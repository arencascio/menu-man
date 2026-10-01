# Menu Man Audit Readiness Guide

**Status:** Ready for audit after one known test-suite failure is triaged  
**Target:** Menu Man staging / Vercel Preview only  
**Purpose:** Give Codex or another auditing model the environment, permissions, constraints, and verification steps needed to perform serious correctness and security audits safely.

---

## 1. Audit target and revision identity

### Primary audit target

- Application: **Menu Man**
- Branch: **`staging`**
- Vercel environment: **Preview / staging**
- Supabase environment: **Menu Man Staging**
- Supabase project ref: **`jjvongzvtnzlvwdfcnjk`**
- Primary restaurant tenant: **Armando's**
- Secondary audit tenant: **Test Kitchen**

Production is **not** an audit target.

### Verified revision

The current staging branch/worktree was confirmed clean and synchronized with origin.

Recorded revision:

- Full SHA: `b426447524604889dde3b785e7bb9b475c227e81`
- Short SHA: `b426447`
- Commit: `menu presentation polish`

The operator has separately confirmed that the current intended HEAD is the deployed staging Preview revision.

### Audit-start identity check

Before any substantial audit work, verify all of the following still agree:

1. `git rev-parse HEAD`
2. `git log -1 --oneline`
3. Vercel Preview deployment commit
4. diagnostics/build identifier, if available
5. Supabase project ref = `jjvongzvtnzlvwdfcnjk`

Do not assume a reachable Preview is current merely because it is on the staging domain.

---

## 2. Local validation and known test status

Preferred validation commands:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

### Current verified state

- `npx tsc --noEmit` — **PASS**
- `npm run lint` — **PASS**
- `npm run build` — **PASS**
  - optimized production build compiled
  - TypeScript completed
  - page data collection completed
  - static generation completed
- `git diff --check` — **PASS**
- `npm test` — **217 passed / 1 failed / 218 total**

### Known failing test

The only currently observed failing test is:

`menu section controls are bookmarks and never filter the published menu`

Location:

`scripts/menu-browser-navigation.test.ts`

The failure is a source-shape/regex assertion expecting:

```text
navigationIntentRef.current = clearSearchIntent(section.id)
```

Recent browser QA confirmed the intended behavior works on staging:

- search remains the only menu filter
- section selection clears search
- the requested section is navigated to
- section controls remain bookmarks rather than filters

However, do **not** call the full automated suite green until this test is triaged. Determine whether:

1. the implementation is still behaviorally correct and the test is stale/brittle, or
2. the test is exposing a real contract regression.

Fix or deliberately update the test before final audit signoff.

### Restricted-environment note

Some Codex execution environments have returned `spawn EPERM` when Node/esbuild attempts to start child processes.

If that happens:

- do not classify `EPERM` itself as an application defect
- report which command could not execute
- continue static analysis
- provide the command for operator execution in the normal development environment
- use operator-provided local results as evidence, but distinguish them from tool-executed results

---

## 3. Browser and application surfaces

Audit both the public restaurant surface and authenticated management surface.

### Public/customer surface

Primary routes include:

- `/r/[slug]`
- `/r/[slug]/menu`
- `/r/[slug]/location`
- `/r/[slug]/checkout`
- `/r/[slug]/order/[orderId]/payment`
- `/r/[slug]/order/[orderId]/confirmation`

Important flows include:

- homepage/menu navigation
- search and section navigation
- menu item details
- modifier selection
- quick add
- favorites/hearts
- cart
- pickup availability
- pickup scheduling
- checkout
- Square Sandbox payment
- delivery chooser
- payment/confirmation recovery behavior

### Management surface

Primary management routes include:

- `/manage`
- `/manage/[slug]/orders`
- `/manage/[slug]/orders/[orderId]`
- `/manage/[slug]/settings/*`
- `/manage/[slug]/team`

Audit:

- authenticated access
- unauthenticated access
- unauthorized restaurant access
- revoked membership behavior
- role/capability enforcement
- data redaction
- mutation authorization

Do not assume a management route is protected merely because it is not linked publicly.

---

## 4. Tenant-isolation test setup

Use at least two independent staging tenants.

### Tenant A

- Name: **Armando's**
- Slug: `armandos`
- Full restaurant/menu/item IDs should be discovered read-only at audit start.

### Tenant B

- Name: **Test Kitchen**
- Has four test items.
- The four-item fixture is considered sufficient for tenant-boundary testing because the items are intentionally robust enough to exercise the relevant paths.

At audit start, record read-only identifiers for both tenants:

- restaurant UUID
- published menu UUID
- representative menu item UUIDs
- modifier group/option UUIDs where available
- representative order UUIDs created during the audit

### Required cross-tenant tests

Attempt safe staging-only substitution of:

- restaurant IDs
- slugs
- menu IDs
- menu item IDs
- modifier group IDs
- modifier option IDs
- order IDs
- pickup-related identifiers
- management route slugs/IDs

Examples:

- submit an Armando item under Test Kitchen
- submit a Test Kitchen modifier under Armando
- request an Armando order while scoped to Test Kitchen
- request or mutate Test Kitchen management data while authenticated only for Armando, if role setup allows the distinction
- mix pickup/order identifiers between tenants

A resource belonging to Tenant A must not become readable, actionable, or financially effective through Tenant B's scope.

---

## 5. Staging orders and Square Sandbox payments

Staging payment testing is authorized through **Square Sandbox / fake payment information**.

The audit may go all the way through safe staging checkout/payment flows using Square-provided test-card data.

### Payment rules

Allowed:

- Square Sandbox payment creation
- successful sandbox payments
- deterministic decline/error cases
- retry behavior
- reconciliation paths
- cancellation/refund behavior where supported by the sandbox
- duplicate/replay/idempotency testing
- ambiguous/exceptional states that the application explicitly supports in staging

Never:

- use real payment credentials
- submit real-money transactions
- point staging at production Square credentials
- use production payment endpoints

### Test-card reference

The project operator has supplied a separate **Square fake cards** reference containing Square Sandbox test values for:

- success
- decline
- bad CVV
- bad ZIP
- bad expiration

These are test-only values and may be used in staging.

### Synthetic-order labeling

Where customer information is required, prefer clearly synthetic values such as:

- Customer: `AUDIT TEST`
- Email: `audit-test@example.invalid`
- Notes: `AUTOMATED STAGING AUDIT`

Synthetic audit orders may be cancelled, refunded, or otherwise exercised as required by the approved staging-only test plan.

---

## 6. Permitted adversarial testing

The operator explicitly authorizes adversarial testing against **staging only**.

The auditor may:

- browse public application flows
- browse authorized management flows
- make read-only staging database queries
- send direct HTTP requests to staging
- alter client-supplied identifiers
- alter client-supplied prices
- submit malformed payloads
- omit required fields
- substitute cross-tenant IDs
- replay requests
- submit duplicate requests
- test concurrent requests
- test stale state
- test invalid pickup timestamps
- test invalid modifier selections
- test unauthorized routes
- test reasonable input-boundary cases
- create clearly labeled synthetic staging orders
- complete Square Sandbox test payments
- cancel/refund synthetic staging orders where appropriate
- inspect application/runtime logs
- create local test/reproduction scripts

### Direct-request emphasis

Do not limit the audit to browser clicking.

For security/correctness boundaries, prefer direct staging requests where useful to test:

- tampered totals
- foreign IDs
- missing auth
- replay/idempotency
- malformed JSON
- unsupported state transitions
- stale/invalid pickup selections
- concurrency
- oversized but reasonable inputs
- hostile text values for validation/XSS investigation

Browser automation is valuable for end-to-end confirmation, but direct requests are required for meaningful trust-boundary testing.

---

## 7. Mutation and safety boundaries

### Allowed without additional approval

- repository inspection
- static analysis
- local test creation
- read-only staging SQL
- staging browser interaction
- direct staging HTTP requests
- synthetic staging-order creation
- Square Sandbox payment testing
- cancellation/refund of synthetic audit orders
- runtime/log inspection
- temporary local reproduction scripts

### Ask before doing

- applying SQL or migrations
- changing staging tenant configuration
- changing Armando menu data
- changing Test Kitchen fixture data
- bulk record creation
- deleting existing non-audit staging records
- changing auth users or roles
- changing environment variables
- invoking external email/SMS delivery to real recipients
- changing Square application/account configuration
- changing third-party service configuration

### Forbidden during audit

- production database writes
- destructive production testing
- real payment transactions
- production environment changes
- production payment credentials
- DNS/domain changes
- attacks against unrelated third-party infrastructure
- automatic deployment of audit fixes
- destructive load/DoS testing

---

## 8. Audit workflow

The first serious audit pass is **REPORT-ONLY**.

Do not automatically fix findings.

For every finding, report:

1. title
2. affected component/files
3. severity
4. confidence
5. concrete code path
6. realistic preconditions
7. safe reproduction, where possible
8. impact
9. evidence
10. recommended smallest remediation
11. suggested regression test

Classify findings as one of:

- confirmed exploitable/incorrect behavior
- strongly supported code defect
- defense-in-depth improvement
- theoretical concern
- maintainability/style issue

Do not inflate severity.

After human triage, approved fixes should be implemented as separate bounded tasks.

---

## 9. High-value correctness audit areas

### Commerce integrity

Audit:

- server-authoritative pricing
- cart-to-order transformation
- modifier validation
- duplicate modifier IDs
- required modifier enforcement
- item/orderability enforcement
- pickup availability
- pickup capacity
- capacity release
- race conditions
- advisory locks / transaction boundaries
- idempotency
- duplicate/replayed requests
- payment-attempt lifecycle
- payment reconciliation
- ambiguous provider outcomes
- cancellation
- refund lifecycle
- late payment success
- stale order state
- multi-tab behavior
- checkout abandonment
- immutable order snapshots
- timezone handling
- weekly/special hours
- DST behavior
- pagination/result limits
- malformed data
- scale assumptions

Explicitly look for bugs similar in class to the previously discovered modifier-override pagination defect: apparently correct logic operating on silently incomplete data.

---

## 10. High-value security audit areas

Audit:

- authentication
- authorization
- tenant isolation
- management-route protection
- role/capability enforcement
- service-role usage
- server/client trust boundaries
- Supabase access patterns
- RPC authorization
- route/API validation
- customer data exposure
- order data exposure
- payment capability exposure
- price tampering
- modifier tampering
- pickup tampering
- IDOR/BOLA
- CSRF assumptions
- XSS/content handling
- unsafe redirects/URLs
- webhook signature verification
- webhook replay/duplication
- provider-account binding
- rate limiting
- abuse controls
- environment/secret exposure
- logging of sensitive data
- CSV/formula injection
- notification/email authorization
- staging-only features leaking to production

---

## 11. Browser/runtime limitations

A desktop browser or responsive emulation is not equivalent to a real Pixel/mobile environment.

Use browser automation for:

- deterministic customer flows
- management flows
- DOM/state verification
- request/response observation

Use direct HTTP/database tests for:

- concurrency
- cross-tenant substitution
- replay/idempotency
- malformed requests
- authorization boundaries
- server-authoritative validation

Real-device QA remains appropriate for:

- touch behavior
- mobile keyboard
- safe-area behavior
- mobile browser scrolling
- platform-specific interaction quirks

Do not treat inability to reproduce a mobile-only presentation issue in desktop automation as proof that no issue exists.

---

## 12. Audit exit criteria

An audit is not complete until:

- audit revision/environment identity was verified
- both staging tenants were identified
- relevant findings include evidence
- speculative findings are labeled as such
- cross-tenant tests were attempted
- payment tests used Square Sandbox only
- full local TypeScript/lint/build validation succeeded
- the known menu-browser navigation test failure was resolved or deliberately updated
- high-severity findings were manually reviewed
- approved fixes received regression tests where practical
- a second verification pass checked the fixes
- no production systems were modified

---

## 13. Current readiness summary

**Ready now:**

- current staging revision identified
- production build succeeds locally
- TypeScript succeeds locally
- lint succeeds locally
- diff check succeeds locally
- Armando's available as primary tenant
- Test Kitchen available as secondary tenant
- Square Sandbox payment testing authorized
- staging adversarial HTTP testing authorized
- read-only staging DB inspection authorized
- mutation boundaries approved

**Open before final signoff:**

- triage the single failing menu-browser navigation test
- record exact tenant IDs at audit start
- verify the target Preview still matches the intended HEAD immediately before the expensive audit begins

Once the navigation test is triaged, the project is ready for a high-effort correctness/security audit.
