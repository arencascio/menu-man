# Menu Man Project State

Last reviewed: 2026-09-08

## Current Architecture

Menu Man is a standalone Next.js App Router application backed by Supabase. The current production path is:

```text
/r/[slug]
```

The route is server-rendered. It uses the Supabase service-role client on the server to fetch an active restaurant, its published menu, active sections, and section-item placements. Interactive rendering is delegated to the client component `src/app/r/[slug]/MenuBrowser.tsx`.

The preserved files under `prototype/` are reference/source artifacts only. The Wix direction is abandoned and is not part of the current architecture.

## Stack

- Next.js `16.3.4`, App Router, TypeScript
- React `19.2.8`
- Supabase JavaScript client `@supabase/supabase-js`
- `tsx` for the TypeScript importer script
- CSS Modules and global CSS
- ESLint 9 and TypeScript strict checking
- No Tailwind, UI framework, ordering provider, auth provider, or hostname-routing layer
- Provider-agnostic client analytics with optional GA4 and PostHog adapters

Useful commands:

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
npm run import-menu -- --file ./data/armandos.json --dry-run
npm run audit-images -- --restaurant armandos
npm run import-images -- --restaurant armandos --folder ./images/armandos --dry-run
```

## Route Structure

- `/`: starter Next.js home page; not the product surface yet.
- `/r/[slug]`: dynamic restaurant menu route.
- `src/app/r/[slug]/page.tsx`: server component and Supabase data loader.
- `src/app/r/[slug]/MenuBrowser.tsx`: client component for menu interaction.
- `src/app/r/[slug]/menu-browser.module.css`: route-local menu styling.
- `src/lib/supabase/server.ts`: server-only Supabase client using environment variables.
- `src/lib/seo/`: route metadata, canonical URL, and Restaurant JSON-LD helpers.
- `src/lib/analytics/`: typed provider-agnostic event API with optional GA4 and PostHog adapters.
- `src/instrumentation-client.ts`: client-safe PostHog initialization using the Next.js 16 instrumentation convention.

The route looks up an active restaurant by `restaurants.slug`, then one published menu for that restaurant. It loads active sections ordered by `sort_order` and item placements ordered in memory by placement `sort_order`.

## Database Schema Contract

The repository does not contain Supabase migration tooling or generated database types. The following is the schema contract currently expected by the route/importer.

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

Sourced item identity is `restaurant_id + source_system + source_item_id`. `name` is display data, not identity. Native/manual items may leave both source fields null.

### `menu_section_items`

- `id`
- `section_id`
- `item_id`
- `sort_order`

The importer uses `section_id` and `item_id`; `menu_section_id` and `menu_item_id` are not valid columns.

## Schema Migration

The exact SQL is in `scripts/menu-items-source-identity.sql`. It adds nullable source identity fields and `restaurant_id` to `menu_items`, then creates a partial unique index for rows where all sourced identity fields are present.

Image provenance/storage SQL is in `scripts/menu-image-assets.sql`. It adds `source_image_url` and `image_path`, copies existing `image_url` values into `source_image_url` without deleting the legacy column, configures the `restaurant-assets` bucket, and adds public-read/server-write Storage grants. Runtime image preference is `image_path`, then `source_image_url`, then placeholder.

Theme SQL is in `scripts/restaurant-theme.sql`. It adds `theme_preset` and `theme_overrides jsonb`. Presets and strict override validation live under `src/lib/themes/`; arbitrary tenant CSS/HTML is not supported.

SEO SQL is in `scripts/restaurant-seo.sql`; it adds nullable `primary_domain`. Apply it manually before configuring canonical domain values.

Restaurant profile and hours SQL is in `scripts/restaurant-content.sql`. Armando placeholder content is in `scripts/armandos-restaurant-content.sql`; it intentionally uses visible placeholder copy, null contact/order/social URLs, and closed hours rather than inventing facts. Apply the migration first and the seed second in Supabase. The route currently assumes the new profile columns exist, but gracefully renders without hour rows if the hours table has no records.

The repository does not prove whether that SQL has been applied to the remote Supabase project. Apply and verify it in Supabase before a live sourced import. No application code should assume the migration succeeded solely because the file exists.

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
- Is intended to be rerunnable without duplicating logical sourced items or placements.
- Supports quoted CSV values and reports malformed input, missing fields, conflicting section descriptions, and duplicate placement identities.

The importer uses service-role credentials from `.env.local` through `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never expose the service-role key to browser code or commit `.env.local`.

## Armando Dataset Status

`data/armandos.json` was generated from the real source CSV in `prototype/`.

- Restaurant slug: `armandos`
- Menu name: `Main Menu`
- Sections: 26
- Items: 309
- Source system: `doordash`
- Unique source item IDs: 309
- Section and item ordering preserved from the source
- Prices normalized to integer cents
- One missing description preserved as `null`
- 24 missing image URLs preserved as `null`
- Duplicate display names were preserved as distinct sourced records
- No image files were uploaded

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
- Expanded item content rendered directly beneath its section heading.
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
- Preserve the standalone prototype as a visual and behavioral reference, not as the production runtime.
- Do not add a UI framework or Tailwind for this product surface.

## Security Assumptions

- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must remain in environment configuration.
- The importer is a privileged operational script and must only be run by trusted operators against the intended Supabase project.
- The current route uses the service-role client and does not implement user authentication or per-restaurant authorization.
- The current route does not expose write operations to browsers.
- Source files and imported descriptions/images are not treated as trusted HTML; React renders them as text and image URLs are passed to image elements.

## Known Limitations

- No committed/generated Supabase types or migration runner exists in the repository.
- Remote migration application status is not recorded locally.
- The route assumes one published menu per restaurant through `.single()`.
- The route currently does not include source identity fields in its item select because the UI does not need them.
- The root page and document metadata still contain starter Next.js content.
- No ordering, cart, payment, fulfillment, auth, customer accounts, or hostname routing exists.
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
| `add_to_cart`, `remove_from_cart` | `item_id`, `item_name`, `price_cents`, `quantity`, `value_cents`, `currency` | `value_cents` is derived as unit price times changed quantity. Defined for ordering but not emitted yet. |
| `cart_viewed`, `checkout_started` | `currency`, `value_cents`, `item_count`, `total_quantity`, `item_ids`, `item_names`, `items` | `items` contains `item_id`, `item_name`, `price_cents`, and `quantity`. Defined but not emitted yet. |
| `purchase` | `transaction_id`, `currency`, `revenue_cents`, `item_count`, `total_quantity`, `item_ids`, `item_names`, `items` | Transaction ID supports deduplication and contains no customer PII. Defined but not emitted yet. |

Ordering analytics use ISO currency codes and integer cents in the Menu Man/PostHog contract. The GA4 adapter converts monetary values to currency units and maps `cart_viewed` to `view_cart` and `checkout_started` to `begin_checkout` while retaining GA4's standard `add_to_cart`, `remove_from_cart`, and `purchase` names.

## Immediate Roadmap

1. Apply and verify `scripts/menu-items-source-identity.sql` in the target Supabase project.
2. Re-run the Armando dry run, then perform the live import only after confirming the remote columns and unique index.
3. Verify `/r/armandos` against the imported 26-section, 309-item dataset, including duplicate display names.
4. Add generated Supabase schema types or migration tooling before further schema evolution.
5. Replace starter root-page metadata/content when product-level navigation and SEO work is in scope.
6. Define stale-record reconciliation before using imports as ongoing synchronization.
7. Replace Armando placeholder profile values with verified restaurant-owned content.
8. Apply image/theme SQL, run the image audit, and establish an explicit asset replacement policy before uploading owned imagery.
9. Apply SEO SQL, set `NEXT_PUBLIC_SITE_URL`, configure the desired GA4 and/or PostHog public variables, and verify `/r/[slug]` metadata and analytics in the target deployment.

## Ordering v1 Scope

Ordering v1 is future work and is intentionally not implemented. The expected first scope is:

- Display a menu item and its price from the published menu.
- Let a customer choose an item and quantity.
- Build a temporary cart in the browser.
- Capture the minimum customer/order details required by the restaurant.
- Create a server-authorized order record and a clear confirmation state.
- Keep payment, fulfillment integrations, staff workflows, and advanced customization out of the first slice unless separately specified.

Ordering v1 must not move Supabase service-role access into client code. It also must not change the canonical menu/item/placement model just to support cart state.

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
- Only the constrained restaurant-menu query may be sent as free-form analytics text. Do not send customer notes, contact-form contents, or other potentially sensitive free-form input.
- Do not add ordering, authentication, hostname routing, analytics, or SEO as implicit side effects of menu work.
- Do not treat the abandoned Wix prototype as a current production dependency.
- Keep the standalone prototype available as a reference when changing the production menu UI.
- Do not invent restaurant hours, contact details, addresses, social accounts, or order URLs in seed data.
- Do not collapse multiple business-hour intervals into one daily column or one JSON blob.
