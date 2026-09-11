# Menu Man Project State

Last reviewed: 2026-09-08

## Current Architecture

Menu Man is a standalone Next.js App Router application backed by Supabase. The current production path is:

```text
/r/[slug]
```

The route is server-rendered. It uses the Supabase service-role client on the server to fetch an active restaurant, its published menu, active sections, section-item placements, and reusable modifier configuration. Interactive menu ordering and cart rendering are delegated to the client component `src/app/r/[slug]/MenuBrowser.tsx`; no database write capability crosses that boundary.

The preserved files under `prototype/` are reference/source artifacts only. The Wix direction is abandoned and is not part of the current architecture.

## Stack

- Next.js `16.3.4`, App Router, TypeScript
- React `19.2.8`
- Supabase JavaScript client `@supabase/supabase-js`
- `tsx` for TypeScript operational scripts and tests
- Zod `4.5.4` for strict checkout request/response validation and normalization
- CSS Modules and global CSS
- ESLint 9 and TypeScript strict checking
- No Tailwind, UI framework, ordering provider, auth provider, or hostname-routing layer
- Provider-agnostic client analytics with optional GA4 and PostHog adapters
- A restaurant-scoped client cart persisted in `localStorage`
- A server-only authoritative checkout-preparation endpoint backed by one restricted PostgreSQL transaction
- A provider-neutral payment foundation with a signed development/staging fake provider

Useful commands:

```bash
npm run dev
npm test
npm run test:migrations
npm run lint
npx tsc --noEmit
npm run build
npm run import-menu -- --file ./data/armandos.json --dry-run
npm run import-menu:staging -- --file ./data/armandos.json --dry-run
npm run audit-images -- --restaurant armandos
npm run import-images -- --restaurant armandos --folder ./images/armandos --dry-run
```

## Route Structure

- `/`: starter Next.js home page; not the product surface yet.
- `/r/[slug]`: dynamic restaurant menu route.
- `src/app/r/[slug]/page.tsx`: server component and Supabase data loader.
- `src/app/r/[slug]/MenuBrowser.tsx`: client component for menu interaction.
- `src/app/r/[slug]/OrderItemPanel.tsx`: orderable item form, modifier validation, quantity, and special instructions.
- `src/app/r/[slug]/CartPanel.tsx`: cart rendering and line editing controls.
- `src/app/r/[slug]/CheckoutPanel.tsx`: customer/pickup/tip form, cart review, authoritative confirmation, and fake-provider staging payment controls.
- `src/app/r/[slug]/useRestaurantCart.ts`: restaurant-scoped cart state, persistence, and ordering analytics.
- `src/app/r/[slug]/menu-browser.module.css`: route-local menu styling.
- `src/lib/cart/`: typed cart model, integer-cent calculations, validation, reducer, and storage boundary.
- `src/lib/checkout/`: strict public contracts plus server-only Supabase RPC integration.
- `src/lib/payments/`: provider contracts, registry, orchestration, normalized events, and the fake adapter.
- `/api/restaurants/[slug]/pickup-availability`: explicitly dynamic, non-cacheable operational availability projection. It is advisory only.
- `/api/restaurants/[slug]/orders`: explicitly dynamic server-only checkout POST; it accepts no prices and prepares payment only after order creation commits.
- `/api/orders/[orderId]/payment-session`, `/payments`, and `/payment-status`: checkout-capability-protected payment endpoints.
- `/api/webhooks/payments/fake`: signed non-production fake-provider webhook endpoint.
- `src/lib/supabase/server.ts`: server-only Supabase client using environment variables.
- `src/lib/seo/`: route metadata, canonical URL, and Restaurant JSON-LD helpers.
- `src/lib/analytics/`: typed provider-agnostic event API with optional GA4 and PostHog adapters.
- `src/instrumentation-client.ts`: client-safe PostHog initialization using the Next.js 16 instrumentation convention.

The route looks up an active restaurant by `restaurants.slug`, then one published menu for that restaurant. It loads active sections ordered by `sort_order` and item placements ordered in memory by placement `sort_order`.

## Database Schema Contract

The authoritative clean-environment schema is committed under `supabase/migrations/`. Generated Supabase TypeScript database types are not yet committed. The following is the schema contract expected by the route/importer.

### `restaurants`

- `id`
- `name`
- `slug`
- `currency`
- `is_active`
- `timezone` nullable IANA timezone such as `America/Los_Angeles`
- `logo_url`, `hero_image_url`
- `tagline`, `description`
- `phone`
- `address_line1`, `city`, `state`, `postal_code`
- `latitude`, `longitude`
- `doordash_url`, `pickup_url`, `google_maps_url`
- `instagram_url`, `facebook_url`
- `primary_color`, `accent_color`
- `primary_domain` nullable canonical domain/base URL; does not enable hostname routing

Address and contact fields intentionally remain on `restaurants` for v1. There is no locations abstraction.

### `restaurant_business_hours`

- `id`
- `restaurant_id`
- `day_of_week` constrained to `0` through `6` (Sunday through Saturday)
- `open_time`, `close_time`
- `is_closed`
- `sort_order`

Hours are normalized because one day can contain multiple opening intervals. The identity constraint is `(restaurant_id, day_of_week, sort_order)`, not one row per day.

### `menus`

- `id`
- `restaurant_id`
- `name`
- `is_published`

### `menu_sections`

- `id`
- `menu_id`
- `name`
- `description`
- `sort_order`
- `is_active`

### `menu_items`

- `id`
- `restaurant_id` nullable for native/manual items
- `name`
- `description`
- `price_cents`
- `image_url`
- `source_image_url` nullable original external/source image URL
- `image_path` nullable Menu Man-owned Supabase Storage object path
- `source_system` nullable
- `source_item_id` nullable
- `is_orderable` boolean, not null, default `false`

Sourced item identity is `restaurant_id + source_system + source_item_id`. `name` is display data, not identity. Native/manual items may leave both source fields null.

### `menu_section_items`

- `id`
- `section_id`
- `item_id`
- `sort_order`

The importer uses `section_id` and `item_id`; `menu_section_id` and `menu_item_id` are not valid columns.

### Reusable modifiers

- `modifier_groups`: restaurant-owned reusable group identity, name/description, source identity, and active state.
- `modifier_options`: reusable choices within a group, with `default_price_adjustment_cents`, explicit `sort_order`, explicit `is_default`, source identity, and active state.
- `menu_item_modifier_groups`: attaches a reusable group to an item and defines item-specific `min_selections`, `max_selections`, `sort_order`, and active state. `min = max = 1` represents exactly one; `min = 0` represents optional; `max > 1` permits multiple choices.
- `menu_item_modifier_option_overrides`: optional item/option rows for item-specific price, sort, and active overrides. The row includes `modifier_group_id` so composite foreign keys prove that the option belongs to the attached group and all records belong to the same restaurant.

The effective modifier price is resolved in this exact order: non-null item override, option default, then zero. An override of zero is meaningful and must not fall through to the default. Groups and options remain canonical and reusable; menu items are never duplicated to model choices.

`is_default` is an explicit reusable option setting and defaults to `false`; position is never treated as a default. The server first removes inactive options and item-disabled overrides. The client applies the remaining explicit defaults only when their count satisfies that item's attachment `min_selections` and `max_selections`. Invalid default configurations and groups without defaults start unselected. Editing a cart line always restores its saved selections instead of reapplying current defaults.

### Authoritative checkout and orders

- `restaurant_ordering_settings`: one row per restaurant with `pickup_enabled`, `asap_enabled`, `scheduled_pickup_enabled`, lead time, cutoff before close, tax strategy, and tax rate in basis points. No restaurant row is seeded by the migration.
- `restaurant_order_counters`: transactionally locked restaurant-scoped human order-number counter.
- `orders`: restaurant/menu references, restaurant-scoped `order_number`, idempotency key and normalized-request SHA-256 fingerprint, independent order/payment statuses, customer contact fields, order instructions, explicit pickup mode/time/timezone snapshot, currency, tax strategy/rate snapshot, tip rate snapshot, subtotal/tax/tip/total integer cents, and timestamps. The column remains nullable for legacy/pre-checkout compatibility, but `create_order_v1` always allocates it before inserting a checkout-created order.
- `order_items`: current item reference plus immutable snapshots of item name, base price, modifier total, unit price, quantity, line total, instructions, and sort order.
- `order_item_modifiers`: current modifier references plus immutable group name, option name, and modifier price snapshots.

`pickup_mode` is constrained to `asap` or `scheduled`; scheduled orders require `pickup_at`. Checkout resolves ASAP to its current estimated pickup timestamp and snapshots it. `order_number` is separate from the UUID, begins at 1001 for a restaurant without prior numbers, and is unique within that restaurant. Allocation occurs in the same transaction as the order and snapshots.

The order lifecycle is `pending_payment`, `placed`, `confirmed`, `preparing`, `ready`, `completed`, or `cancelled`. `create_order_v1` creates only `pending_payment` with `payment_status = unpaid`. The payment layer is prepared afterward. Only a verified provider event owns the transition to `payment_status = paid` and `order_status = placed`. Operational restaurant queues must exclude `pending_payment`.

## Schema Migration

`supabase/migrations/` is the authoritative deterministic bootstrap for an empty Menu Man Supabase project. Apply every migration in filename order. It creates the platform extension requirement, all foundational catalog tables, restaurant profile/hours, source identity and image storage, presentation/SEO fields, modifiers, order snapshots, ordering settings, checkout functions, constraints, indexes, RLS, triggers, and grants.

The files under `scripts/*.sql` are historical production-upgrade artifacts. They document how the existing legacy production database evolved, but most begin with `alter table` and cannot initialize an empty project. Do not mix them into a clean bootstrap. Do not push the clean baseline to the existing production project until its migration history has been separately audited and reconciled.

Staging-only data lives under `supabase/seeds/staging/` and is intentionally excluded from automatic seeding. SQL contract tests live under `supabase/tests/`. The schema contract test is data-independent; the Armando fixture and checkout contract tests run after the ordered staging seed and roll back checkout-created rows.

The historical source-identity upgrade SQL is in `scripts/menu-items-source-identity.sql`. It adds nullable source identity fields and `restaurant_id` to `menu_items`, then creates a partial unique index for rows where all sourced identity fields are present.

Image provenance/storage SQL is in `scripts/menu-image-assets.sql`. It adds `source_image_url` and `image_path`, copies existing `image_url` values into `source_image_url` without deleting the legacy column, configures the `restaurant-assets` bucket, and adds public-read/server-write Storage grants. Runtime image preference is `image_path`, then `source_image_url`, then placeholder.

Theme SQL is in `scripts/restaurant-theme.sql`. It adds `theme_preset` and `theme_overrides jsonb`. Presets and strict override validation live under `src/lib/themes/`; arbitrary tenant CSS/HTML is not supported.

SEO SQL is in `scripts/restaurant-seo.sql`; it adds nullable `primary_domain`. Apply it manually before configuring canonical domain values.

Restaurant profile and hours SQL is in `scripts/restaurant-content.sql`. Armando placeholder content is in `scripts/armandos-restaurant-content.sql`; it intentionally uses visible placeholder copy, null contact/order/social URLs, and closed hours rather than inventing facts. Apply the migration first and the seed second in Supabase. The route currently assumes the new profile columns exist, but gracefully renders without hour rows if the hours table has no records.

Ordering v1 schema SQL is in `scripts/ordering-v1-schema.sql`. It adds `menu_items.is_orderable default false`, the reusable modifier model, the future order snapshot tables, tenant-consistent foreign keys, constraints, indexes, RLS, and intentionally restricted grants. Apply it before deploying application code that selects `is_orderable` or modifier tables. Apply `scripts/modifier-option-defaults.sql` next; it adds `modifier_options.is_default boolean not null default false`. `scripts/armandos-test-modifiers.sql` is optional test data; apply or rerun it last to mark exactly two known Armando items orderable, attach reusable sample groups, and make Chicken the explicit exactly-one default. It also demonstrates a `$2.00` item override taking precedence over a `$1.50` option default. The seed must be replaced with restaurant-verified modifier data before real ordering.

Authoritative checkout SQL is in `scripts/checkout-v1.sql`; apply it after both ordering schema migrations and before deploying the checkout API/UI. It migrates the order lifecycle to `pending_payment`, adds request/tax/pickup snapshots, creates ordering settings and counters, and defines `get_pickup_availability_v1` and `create_order_v1`. Both are restricted to `service_role`; order creation is a `SECURITY DEFINER` function with an empty search path. The migration revokes direct service-role inserts/updates/deletes on the three order tables so application writes use the function. It deliberately inserts no live restaurant ordering configuration, tax rate, or business hours.

The repository does not prove which historical scripts have been applied to the existing production project. Clean staging environments use migration tracking instead. No application code should assume a remote migration succeeded solely because the file exists.

## Checkout Contracts and Calculations

`POST /api/restaurants/[slug]/orders` requires `Content-Type: application/json` and an `Idempotency-Key` UUID header. The strict body is:

```text
menuId
items[]: menuItemId, quantity, modifierOptionIds[], specialInstructions
customer: name, phone, email
pickup: { mode: asap } | { mode: scheduled, pickupAt }
tipChoice: none | 10_percent | 15_percent | 20_percent
orderNotes
```

Unknown fields, including any client price or total, are rejected. Limits are 50 lines, quantity 1–99, 50 unique modifiers per line, 500 characters per line instruction, and 1,000 characters for order notes. The response contains the UUID, human order number, `pending_payment`/`unpaid` states, currency, authoritative amounts, resolved pickup data, authoritative item snapshots, and an idempotent-replay flag.

Before RPC invocation, Zod produces a normalized object: UUIDs are lowercase; strings are trimmed; empty optional strings become JSON null; email is lowercase; scheduled pickup is converted to UTC ISO format; each modifier ID array is lexically sorted; and item lines are lexically sorted by `[menuItemId, sorted modifier IDs, normalized special instructions, quantity]`. PostgreSQL receives that normalized value as `jsonb` and stores `encode(sha256(convert_to(p_request::text, 'UTF8')), 'hex')`. PostgreSQL `jsonb` canonicalizes object keys. Thus JSON whitespace, object-key order, UUID case, accepted email case/outer whitespace, empty-string versus null optionals, equivalent time-zone offsets, line order, and modifier order produce one fingerprint. Distinct line structure is intentionally not merged.

Idempotency is scoped to `(restaurant_id, idempotency_key)`. The transaction takes an advisory lock for that pair. A retry with the same fingerprint returns the original order with `replayed = true`; the same key with a different normalized fingerprint is rejected with `IDEMPOTENCY_CONFLICT`.

The checkout client reuses its key for ordinary retries. To survive a refresh after an ambiguous network response, it keeps only `{ SHA-256(canonical payload), idempotency UUID }` in restaurant-scoped `sessionStorage`; it does not store the customer fields or canonical request there. The record is deleted as soon as a valid authoritative response is received. A changed normalized request gets a new key.

`GET /api/restaurants/[slug]/pickup-availability` is dynamic operational data: the route declares `dynamic = force-dynamic`, `revalidate = 0`, `fetchCache = force-no-store`, sends no-store CDN/browser headers, and the client fetch uses `cache: no-store`. It returns current ASAP availability and 15-minute scheduled slots labeled in the restaurant timezone. This GET is never authoritative. `create_order_v1` regenerates availability from current settings, IANA timezone, weekly hours, lead time, cutoff, and transaction time before accepting a pickup.

V1 tax is restaurant-configured percentage tax. The server calculates `round(subtotal_cents * tax_rate_basis_points / 10000)` and snapshots the strategy/rate. The reserved `provider` tax strategy cannot create an order yet. Tips are server-owned choices calculated as the selected basis-point percentage of subtotal. All arithmetic persisted to orders is integer cents.

## Menu Importer

`scripts/import-menu.ts` imports local JSON or CSV through:

```bash
npm run import-menu -- --file ./data/armandos.json --dry-run
npm run import-menu -- --file ./data/armandos.json
```

Behavior:

- Validates the complete source before writes.
- Resolves an active restaurant by slug.
- Finds or creates the named menu and publishes it.
- Finds or creates sections and preserves `sort_order`.
- Finds or creates canonical menu items using sourced identity, never display name for sourced records.
- Finds or creates `menu_section_items` placements using `section_id`, `item_id`, and `sort_order`.
- Supports native/manual items with both source fields null.
- Preserves image URLs/paths; it does not upload images.
- Preserves source image URLs in `source_image_url`; it does not upload images.
- Does not write `is_orderable`, so existing item orderability is preserved and new rows use the database default `false`.
- Is intended to be rerunnable without duplicating logical sourced items or placements.
- Supports quoted CSV values and reports malformed input, missing fields, conflicting section descriptions, and duplicate placement identities.

The importer uses service-role credentials from `.env.local` through `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never expose the service-role key to browser code or commit `.env.local`.

The staging command reads `.env.staging.local` and passes `--require-staging`. It refuses to run unless `MENU_MAN_ENV` is exactly `staging`, `MENU_MAN_STAGING_PROJECT_REF` is present, the configured HTTPS Supabase hostname exactly equals `<project-ref>.supabase.co`, and a service-role key is present. The guard reports only the verified project ref, never credentials.

## Armando Dataset Status

`data/armandos.json` was generated from the real source CSV in `prototype/`.

- Restaurant slug: `armandos`
- Menu name: `Main Menu`
- Sections: 26
- Items: 309
- Placements in this fixture version: 309. This is fixture-specific, not a schema invariant; canonical items may appear in multiple sections.
- Source system: `doordash`
- Unique source item IDs: 309
- Section and item ordering preserved from the source
- Prices normalized to integer cents
- One missing description preserved as `null`
- 24 missing image URLs preserved as `null`
- Duplicate display names were preserved as distinct sourced records
- No image files were uploaded
- The optional `scripts/armandos-test-modifiers.sql` seed enables exactly two source items for UI testing; it does not invent modifiers for the remaining 307 items.

The source includes some questionable metadata, including conflicting descriptions for certain repeated categories and notes about missing/new images. Those values were not silently invented or merged.

## Current UI Behavior

The production menu UI currently provides:

- Responsive 3-column desktop layout, 4 columns at larger widths, and 2 columns on mobile.
- Square collapsed item images with a letter placeholder when `image_path` and `source_image_url` are null.
- Full-width section heading rows with descriptions.
- Sticky category and search controls.
- Horizontally scrollable category controls on mobile with hidden scrollbar.
- Approximately 200 ms debounced search over item name and description.
- Inline item expansion with one expanded item at a time.
- Expanded item content rendered directly beneath its section heading, with the existing informational state retained for non-orderable items.
- Orderable item panels with image, description, naturally displayed item price, reusable modifier groups, explicit validated defaults, min/max validation, quantity, special instructions, and a computed display total.
- Add/Update Cart remains visible but uses native disabled semantics and subdued styling until modifier selections are valid.
- Maximum-selection guidance appears only when the maximum is lower than the number of active options; exactly-one groups use concise `Required · Choose 1` guidance.
- A client-side cart supporting add, edit, remove, quantity changes, clear, subtotal, and persistence across refreshes for the same restaurant.
- A checkout panel for customer name, phone, optional email, current ASAP/scheduled choices, tip choice, and optional order notes.
- A server-confirmed order result with restaurant order number and authoritative subtotal, tax, tip, and total. The cart clears only after success.
- A single versioned local-storage cart envelope; opening a different restaurant clears the previous restaurant's cart instead of mixing tenant data.
- Category and search changes collapse the current item.
- Currency-formatted prices using the restaurant currency, falling back to USD.
- Keyboard/button semantics and reduced-motion styling for the interactive cards.

## Architectural Decisions

- Keep restaurant/menu data fetching in a server component so database credentials and query logic stay server-side.
- Keep interactive state in a focused client component rather than converting the route to a client component.
- Keep menu item content canonical and represent section membership/order in `menu_section_items`.
- Treat external source identity as stable data identity; treat display names as mutable presentation data.
- Preserve source image URLs separately from owned Storage paths; runtime prefers owned assets without deleting provenance.
- Keep restaurant profile data normalized for operational fields; keep repeated business-hour intervals in their own table.
- Accept external logo/hero URLs temporarily; menu-item Supabase Storage ownership is now available but still requires explicit uploads.
- Use Supabase Storage for owned menu images without deleting source URLs; canonical item paths do not contain `menu_id`.
- Keep theme presets versioned in code and tenant overrides restricted to a server-validated allowlist.
- Keep UI analytics vendor-agnostic: one typed Menu Man event fans out to every configured provider.
- Keep PostHog explicit-event-only and anonymous: no identification, persistent browser storage, autocapture, automatic page views, or session replay.
- Resolve modifier pricing on the server as item override, then option default, then zero; store the resolved display snapshot in the cart.
- Treat every browser price and total as display-only. Checkout reloads canonical menu/modifier data, validates availability and selections, recalculates every amount, and writes all snapshots in one database transaction.
- Allocate restaurant-scoped order numbers only inside the authoritative checkout transaction.
- Use restaurant-configured percentage tax for v1. PostgreSQL computes `round(subtotal_cents * tax_rate_basis_points / 10000)`; a future provider strategy is reserved but currently rejected at checkout. Tip percentages are likewise server-owned and calculated from subtotal.
- Keep pre-payment records out of operational workflows; only a future trusted payment webhook may mark an order paid and placed.
- Preserve the standalone prototype as a visual and behavioral reference, not as the production runtime.
- Do not add a UI framework or Tailwind for this product surface.

## Security Assumptions

- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must remain in environment configuration.
- The importer is a privileged operational script and must only be run by trusted operators against the intended Supabase project.
- The current route uses the service-role client and does not implement user authentication or per-restaurant authorization.
- The browser can reach only the strict Next.js checkout endpoint. It never receives the service-role key and cannot write database tables directly.
- Checkout accepts menu/item/modifier IDs, quantities, instructions, customer details, pickup selection, and a tip choice; price fields and unknown fields are rejected.
- `create_order_v1` is the write boundary. It reloads restaurant/menu ownership, orderability, active modifier attachments/options, min/max rules, price overrides, hours, pickup configuration, and tax configuration before inserting anything.
- Customer contact details and order notes are stored on the order but never included in analytics events or browser cart persistence.
- Modifier definitions are read through the server-only Supabase client. RLS and grants give `anon` and `authenticated` no direct access to modifier or order tables.
- The cart contains menu snapshots and preparation instructions in browser storage. It does not contain customer identity, contact details, card data, or authoritative totals.
- Source files and imported descriptions/images are not treated as trusted HTML; React renders them as text and image URLs are passed to image elements.

## Known Limitations

- Generated Supabase TypeScript database types are not committed.
- Remote migration application status is not recorded locally.
- The route assumes one published menu per restaurant through `.single()`.
- The route currently does not include source identity fields in its item select because the UI does not need them.
- The root page and document metadata still contain starter Next.js content.
- Finix and Square are not implemented. The payment foundation currently includes only the explicitly enabled development/staging fake provider.
- Payment expiration has a restricted transition function; scheduling the cleanup/reconciliation worker remains operational work.
- No inventory, fulfillment notification, staff dashboard, restaurant admin auth, customer account, or hostname routing exists.
- Holiday/special-date hour exceptions are deferred. Availability is computed through one function so a future exception table can be applied before weekly-hour slot generation without changing the browser contract.
- Pickup slots use 15-minute increments and expose the next seven local calendar days; this is not yet restaurant-configurable.
- Checkout remains disabled until verified hours, timezone, pickup settings, and restaurant percentage tax are configured manually.
- The public checkout endpoint has request-size validation and database idempotency but no distributed rate limiting or bot mitigation yet. Add deployment-edge or durable-store abuse controls before broad production ordering.
- Only the two optional Armando test-seed items are orderable; the other imported items remain browsable with `is_orderable = false` until their real configuration is verified.
- The importer does not delete records removed from a source file; stale sections, items, or placements require a separate reconciliation policy.
- External image URLs may expire, be blocked, or change independently of Menu Man.
- Some source records have missing descriptions or images, and source category descriptions contain conflicts that remain source data issues.
- The restaurant profile migration and Armando seed are manual SQL artifacts; remote application status is not tracked by the repository.
- Image audit/import commands require `scripts/menu-image-assets.sql` to be applied remotely.
- Storage import is conservative: it reports unmatched/missing files, does not overwrite without `--replace`, and never deletes old objects automatically.
- SEO metadata, canonical URLs, Open Graph, Restaurant JSON-LD, sitemap, and robots are server-generated; no restaurant facts are invented.
- Analytics events are sent through `trackEvent()` only. The constrained menu search term is permitted on `menu_search`; customer notes, contact-form content, and other potentially sensitive free-form text are not analytics properties.
- GA4 remains optional through `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4` plus `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- PostHog is optional through `NEXT_PUBLIC_POSTHOG_KEY` plus `NEXT_PUBLIC_POSTHOG_HOST`; it uses the original Menu Man event names and memory-only anonymous state.
- PostHog session replay, autocapture, automatic page views/page leaves, exception capture, heatmaps, performance capture, remote feature configuration, external dependency loading, and person profiles are disabled.

## Analytics Event Property Schema

Application code uses camelCase in the typed `AnalyticsEvent` union. Provider adapters convert these fields to the snake_case properties below. Every event includes `restaurant_id`.

| Menu Man event | PostHog properties beyond `restaurant_id` | Notes |
| --- | --- | --- |
| `page_view` | None | Explicit page view; automatic PostHog page views remain disabled. |
| `category_selected` | `section_id`, `section_name` | Full Menu uses `section_id: "all"` and `section_name: "Full Menu"`. |
| `menu_search` | `query`, `query_length`, `result_count` | `query` is the trimmed, lowercase menu search term. No other free-form customer text is allowed. |
| `menu_item_expanded`, `menu_item_collapsed` | `section_id`, `section_name`, `item_id`, `item_name`, `price_cents` | Prices are integer minor units. |
| `phone_clicked`, `directions_clicked`, `delivery_clicked`, `pickup_clicked` | None | Contact details and destination URLs are not included. |
| `add_to_cart`, `remove_from_cart` | `item_id`, `item_name`, `price_cents`, `quantity`, `value_cents`, `currency` | `price_cents` is the configured unit price including selected modifiers; `value_cents` is unit price times the quantity added or removed. Emitted by cart operations. |
| `cart_viewed`, `checkout_started` | `currency`, `value_cents`, `item_count`, `total_quantity`, `item_ids`, `item_names`, `items` | `items` contains `item_id`, `item_name`, `price_cents`, and `quantity`. Emitted when the respective cart/checkout panel opens. Values are browser estimates. |
| `order_created` | `order_id`, `order_number`, `currency`, `value_cents`, `tax_cents`, `tip_cents`, `pickup_mode`, `idempotency_replay`, item summary fields | Emitted only after the server returns an authoritative `pending_payment`/`unpaid` order. This is not a purchase. No customer fields or notes are sent. |
| `purchase` | `transaction_id`, `currency`, `revenue_cents`, `item_count`, `total_quantity`, `item_ids`, `item_names`, `items` | Server-only. A verified successful payment inserts one transactional outbox event; browser analytics cannot construct it. |

Ordering analytics use ISO currency codes and integer cents in the Menu Man/PostHog contract. The browser GA4 adapter converts monetary values to currency units and maps `cart_viewed` to `view_cart` and `checkout_started` to `begin_checkout`. Purchase delivery is isolated to the server-side outbox path.

## Immediate Roadmap

1. Bootstrap the new staging project from `supabase/migrations/`, then run the explicitly guarded staging seed/import sequence.
2. Run the SQL schema, fixture, and checkout contract tests against staging, including idempotent replay and same-key/different-payload conflict.
3. Reconcile the existing production project's schema and migration history before considering any migration-tool adoption there; do not apply the clean baseline directly.
4. Replace all test modifiers with restaurant-verified configuration before enabling production ordering.
5. Integrate Finix against the provider-neutral contracts, then add Square without changing checkout state ownership.
6. Define pending-payment expiration, holiday exceptions, notification, and operational queue policies.
7. Add generated Supabase schema types before further schema evolution.

## Ordering v1 Scope

Ordering v1 includes explicit item orderability, reusable min/max modifier groups, item-specific price overrides, an orderable item panel, a persistent restaurant-isolated client cart, and authoritative checkout preparation. The browser submits no prices. The Next.js server normalizes the request and invokes a restricted PostgreSQL function that independently revalidates pickup and creates the order/snapshot rows transactionally. A separate payment layer then creates a logical payment and accepts only provider-issued opaque payment tokens.

The fake provider can exercise payment behavior in development/staging. A created order remains `pending_payment` / `unpaid` until a verified event succeeds. Browser code cannot emit `purchase`; verified success inserts the server-side purchase outbox record transactionally.

## Do Not Regress

- Do not make `/r/[slug]/page.tsx` a client component just to add interaction.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Do not use item `name` as the identity key for sourced menu data.
- Do not merge distinct source records that share a display name.
- Do not replace `section_id`/`item_id` with `menu_section_id`/`menu_item_id`.
- Do not move section or item ordering into array position alone; preserve database/source `sort_order` values.
- Do not discard null descriptions or image URLs by inventing content.
- Do not upload or rewrite source image URLs as part of the importer until explicitly designed.
- Do not overwrite or discard `source_image_url` when setting `image_path`.
- Do not put `menu_id` in canonical menu-item asset paths.
- Do not allow arbitrary tenant CSS, selectors, HTML, URLs, or style blocks through theme overrides.
- Do not scatter direct `gtag()` calls through UI components; keep provider logic behind the analytics adapter.
- Do not scatter direct `posthog.capture()` calls through UI components; keep provider logic behind the analytics adapter.
- Do not make imported items orderable by default; browseability and orderability are separate.
- Do not trust cart snapshots, modifier prices, quantities, or totals at checkout; reload and validate canonical data server-side.
- Do not treat `/pickup-availability` as authoritative or cacheable; checkout must revalidate the selection inside its transaction.
- Do not place `pending_payment` orders into restaurant operational queues.
- Do not let browser code insert authoritative `orders`, `order_items`, or `order_item_modifiers` rows.
- Only the constrained restaurant-menu query may be sent as free-form analytics text. Do not send customer notes, contact-form contents, or other potentially sensitive free-form input.
- Do not add payment, authentication, hostname routing, analytics, or SEO as implicit side effects of menu work.
- Do not treat the abandoned Wix prototype as a current production dependency.
- Keep the standalone prototype available as a reference when changing the production menu UI.
- Do not invent restaurant hours, contact details, addresses, social accounts, or order URLs in seed data.
- Do not collapse multiple business-hour intervals into one daily column or one JSON blob.
