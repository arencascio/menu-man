This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Clean Supabase bootstrap

[`supabase/migrations`](supabase/migrations) is the authoritative ordered schema
for a completely empty Menu Man Supabase environment. It includes foundational
catalog tables, profile/hours, source and image fields, Storage, themes, SEO,
modifiers, orders, ordering settings, checkout RPCs, RLS, grants, indexes, and
triggers. Apply the files in filename order, normally with `supabase db push`
after linking the CLI to the intended new project.

The SQL files under `scripts/` are historical production-upgrade artifacts.
They assume legacy tables already exist and must not be used to bootstrap an
empty database or mixed into a clean migration run.

Staging data is never automatic. Follow
[`supabase/seeds/staging/README.md`](supabase/seeds/staging/README.md) after the
schema migration. The staging menu command requires `.env.staging.local`,
`MENU_MAN_ENV=staging`, and a Supabase hostname matching
`MENU_MAN_STAGING_PROJECT_REF` exactly:

```bash
npm run import-menu:staging -- --file ./data/armandos.json --dry-run
npm run import-menu:staging -- --file ./data/armandos.json
```

## Menu imports

Import a structured menu with the service-role key:

```bash
npm run import-menu -- --file ./menu.json --dry-run
npm run import-menu -- --file ./menu.json
npm run audit-images -- --restaurant armandos
npm run import-images -- --restaurant armandos --folder ./images/armandos --dry-run
```

## Existing-production Ordering v1 upgrade history

These historical scripts describe the incremental upgrade path used by the
existing production database. They are retained for auditability; clean
environments use `supabase/migrations/` instead.

The historical order is:

1. [`scripts/ordering-v1-schema.sql`](scripts/ordering-v1-schema.sql) — required schema, constraints, RLS, and restricted grants.
2. [`scripts/modifier-option-defaults.sql`](scripts/modifier-option-defaults.sql) — required explicit modifier-option default flag.
3. [`scripts/checkout-v1.sql`](scripts/checkout-v1.sql) — required authoritative checkout RPC, restaurant ordering settings, order counters, status migration, RLS, and restricted grants.
4. [`scripts/armandos-test-modifiers.sql`](scripts/armandos-test-modifiers.sql) — optional test/staging seed for exactly two known Armando items; apply or rerun it after the schema migrations.

All imported items default to `is_orderable = false`; the importer does not change that flag. Modifier options default to `is_default = false`, and ordering does not infer defaults from sort order. The optional seed explicitly enables only its two target items and marks Chicken as the sample default meat. Replace test modifier definitions with restaurant-verified data before real ordering.

The cart is stored in the browser under `menu-man:cart:v1`, persists across refreshes, and is cleared when a different restaurant is opened. Its prices and totals are display-only. Checkout posts IDs and selections to the Next.js server, which invokes the restricted PostgreSQL transaction in `create_order_v1`; that transaction reloads authoritative data and writes order snapshots. New records are `pending_payment` / `unpaid`. Payment preparation runs only after that transaction commits, and only a verified provider event can move an order to `placed` / `paid`. The cart is retained until that verified transition.

`checkout-v1.sql` intentionally enables no restaurant. Before checkout can succeed, an operator must configure verified business hours, a valid IANA restaurant timezone, and one `restaurant_ordering_settings` row with verified pickup rules and a verified tax rate in basis points. Do not use sample values in production.

Run the cart tests and application checks with:

```bash
npm test
npm run test:migrations
npm run lint
npx tsc --noEmit
npm run build
```

## Fake payment provider

The provider-neutral payment foundation includes a signed fake provider for
development and staging. It is unavailable when `MENU_MAN_ENV=production`,
requires an explicit enable flag, and only accepts database connections marked
with the `test` environment:

```text
MENU_MAN_ENV=staging
MENU_MAN_ENABLE_FAKE_PAYMENTS=true
MENU_MAN_FAKE_WEBHOOK_SECRET=<at-least-32-random-characters>
```

Apply `supabase/seeds/staging/004_armandos_fake_payments.sql` only to staging.
The checkout exposes deterministic success, decline, unknown outcome, delayed,
duplicate, out-of-order, authorization-only, refund, and late-success cases.
Fake events use the same signature verification, webhook inbox, deduplication,
state transition, audit, and server purchase-outbox path used by future real
provider adapters. No card fields or raw card data are accepted.

Guest payment endpoints are protected by an order-scoped, HTTP-only,
SameSite cookie. The opaque checkout capability is never exposed to browser
JavaScript. Payment and confirmation use discrete routes:

- `/r/[slug]/checkout`
- `/r/[slug]/order/[orderId]/payment`
- `/r/[slug]/order/[orderId]/confirmation`

Payment endpoints are:

- `POST /api/orders/[orderId]/payment-session`
- `POST /api/orders/[orderId]/payments`
- `GET /api/orders/[orderId]/payment-status`
- `POST /api/webhooks/payments/fake` (non-production only)

Conclusive payment failure terminally cancels the frozen order with a specific
`payment_declined` or `payment_failed` reason so another attempt cannot be
reserved for that order. Unknown, processing, and authorized outcomes remain
locked pending an authoritative provider update. Cross-tab browser messages
only trigger a server status refetch; they are never trusted as payment state.

The browser analytics API cannot construct `purchase`. A verified successful
payment event writes one server-side `purchase` record to `analytics_outbox`.

Optional analytics configuration:

```text
# GA4
NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_XXXXXXXXXX
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

GA4 is enabled when both of its values are present. PostHog is enabled when both of its values are present. Configure either provider, both providers, or neither; each Menu Man event fans out to every configured provider. Components call the provider-agnostic `trackEvent()` API and never call a vendor SDK directly. PostHog is configured for explicit events only, without customer identification, persistent browser storage, autocapture, or session replay.

Apply [scripts/restaurant-seo.sql](scripts/restaurant-seo.sql) before configuring a canonical primary domain. Set `NEXT_PUBLIC_SITE_URL` for absolute canonical, sitemap, and robots URLs; local development falls back to `http://localhost:3000`.

JSON uses `restaurantSlug`, `menuName`, and a `sections` array. Each section has `name`, `description`, `sortOrder`, and `items`. Each item has `name`, `description`, `priceCents`, `imageUrl`, and `sortOrder`.

CSV uses one row per item placement with these headers. `sourceSystem` and `sourceItemId` are optional columns for external records; when present, both must be populated on each sourced row:

```text
restaurantSlug,menuName,sectionName,sectionDescription,sectionSortOrder,itemName,itemDescription,priceCents,imageUrl,itemSortOrder,sourceSystem,sourceItemId
```

The importer validates the complete file before writing, preserves both ordering fields, and updates existing restaurant/menu/section/item/placement records instead of creating duplicates. It does not upload images.

Menu item image provenance is split between `source_image_url` (the original external URL) and `image_path` (an owned Supabase Storage object). Runtime rendering prefers `image_path`, then `source_image_url`, then a placeholder. Apply [scripts/menu-image-assets.sql](scripts/menu-image-assets.sql) before using the image audit or image importer; the migration preserves the legacy `image_url` column during rollout.

`npm run audit-images` is read-only. `npm run import-images` matches filenames such as `198880592.jpg` or `doordash_198880592.webp` to sourced items, writes to a stable menu-item path, and requires `--replace` before replacing an existing owned image. It never deletes old objects automatically.

Restaurant themes use `theme_preset` plus validated `theme_overrides`. Presets live in code and become CSS custom properties; arbitrary CSS, selectors, HTML, URLs, and style blocks are not supported.

External items should also provide `sourceSystem` and `sourceItemId`. Sourced item identity is `restaurant_id + source_system + source_item_id`; display names are not identity keys. Apply [scripts/menu-items-source-identity.sql](scripts/menu-items-source-identity.sql) before importing sourced data. Leave both source fields null for native Menu Man items.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
