# Super Tacos Sprint C.3 local handoff

## Current release status — 2026-10-21

Gate 2 subsequently committed and verified the Staging content synchronization,
as confirmed in the owner's completed Gate 2 handoff. The preparation/failed
attempt descriptions below are historical, not current execution instructions.
Do not rerun 015 or 016. This review performed no database operations and does
not substitute a fresh live verification for the completed Gate 2 evidence.
The separate Production package and release gates are reviewed in
`v1-combined-release-readiness.md`; no Production operation is authorized.

## Original preparation handoff (historical)

This local work remains on `feature/super-tacos-demo`. The original 015 installer is unchanged and must not be rerun. The regenerated 016, backup export, and read-only verification are **prepared only** for Staging `jjvongzvtnzlvwdfcnjk`; none has been executed. No payment, Production, Vercel, or Supabase setting was changed.

## Active catalog

IDs are the existing deterministic item IDs (suffix shown). All 25 active items have owner-approved photographs under `public/img/super-tacos/approved/`. Prices are sample USD.

| Section | ID | Item | Price | Image | Modifier groups |
| --- | ---: | --- | ---: | --- | --- |
| Street Tacos | 201 | Street Taco | $3.50 | `carne-asada-tacos.webp` | Taco filling, salsa, tortilla, extras |
| Street Tacos | 238 | Fish Taco | $5.25 | `fish-taco.webp` | Tortilla, salsa |
| Street Tacos | 243 | Super Taco | $7.95 | `super-taco.webp` | Taco filling, salsa |
| Burritos | 204 | Super Burrito | $12.95 | `burrito.webp` | Salsa, extras |
| Burritos | 205 | Burrito | $10.95 | `chicken-burrito.webp` | Burrito filling, salsa, extras |
| Burritos | 206 | Black Bean Burrito | $8.95 | `black-bean-burrito.webp` | Salsa, extras |
| Clásicos Mexicanos | 208 | Loaded Nachos | $9.45 | `loaded-nachos.webp` | Topping, salsa, extras |
| Clásicos Mexicanos | 209 | Quesadilla | $8.45 | `quesadilla.webp` | Topping, salsa, extras |
| Clásicos Mexicanos | 233 | Loaded Rolled Tacos | $9.95 | `loaded-taquitos.webp` | Salsa |
| Clásicos Mexicanos | 234 | Chorizo Queso Fundido | $10.95 | `queso-fundido.webp` | — |
| Clásicos Mexicanos | 235 | Sopes | $10.95 | `sopes.webp` | Salsa, extras |
| Clásicos Mexicanos | 237 | Ranchero Plate | $12.95 | `ranchero-plate.webp` | — |
| Clásicos Mexicanos | 239 | Menudo | $13.95 | `menudo.webp` | — |
| Clásicos Mexicanos | 241 | Shrimp Cocktail | $14.95 | `shrimp-cocktail.webp` | — |
| Breakfast | 221 | Breakfast Burrito | $10.45 | `breakfast-burrito.webp` | Breakfast filling, salsa, extras |
| Breakfast | 224 | Breakfast Quesadilla | $9.95 | `breakfast-quesadilla.webp` | Salsa, extras |
| Breakfast | 232 | Chilaquiles Divorciados | $12.95 | `chilaquiles.webp` | Extras |
| Breakfast | 236 | Huevos Divorciados | $11.95 | `huevos-divorciados.webp` | — |
| Sides & Refreshers | 210 | House Salsa Sampler | $6.95 | `salsas.webp` | — |
| Sides & Refreshers | 227 | Chips & Salsa | $4.50 | `chips-and-salsa.webp` | Salsa |
| Sides & Refreshers | 231 | Horchata | $3.95 | `horchata.webp` | Drink size |
| Sides & Refreshers | 240 | Mexican Coke | $4.25 | `mexican-coke.webp` | — |
| Sides & Refreshers | 242 | Tortillas | $2.95 | `tortillas.webp` | Tortilla |
| Sweet Finish | 228 | Cinnamon Churros | $5.95 | `churros.webp` | Churro portion |
| Sweet Finish | 229 | Two Cinnamon Churros | $3.95 | `churros.webp` | — |

New IDs 235–243 map to source fixture numbers 35–43. Existing ID 204 changes name from Grilled Steak Burrito to Super Burrito with source key, price, and attachments preserved. Section 103 retains its ID, anchor, and sort order while changing from Griddle Favorites to Clásicos Mexicanos. Ranchero Plate uses the Clásicos section because the approved photo depicts a steak plate, not eggs. Super Taco is a two-taco signature serving with required filling selection; Street Taco remains the single taco with required filling. The 18 C.2 retired rows, order references, and favorite relationships are retained.

## Assets and branding

The nine new photos were converted from the owner's `menu items` folder without cropping, with source and output hashes in `public/img/super-tacos/approved/provenance.json`. The owner-supplied `supertacologo.svg` was inspected; its hidden embedded PNG layer was removed from the packaged SVG. The visible vector symbol is used with the shared Titan One wordmark in navigation and footer, and as the Super Tacos route icon. `logo-provenance.json` records both SVG hashes. Armando's identity is unchanged; the footer reveal remains.

## Fictional location

The fixture proposes 0000 Magnolia Avenue, Riverside, CA 92503 and (951) 555-0147. The existing 9:00 AM–10:00 PM daily fixture hours remain. Homepage, location, menu, About, Catering, and footers show these details. The demo phone is plain text, directions to the fictional address stay disabled, and the home page omits Restaurant JSON-LD for the fictional business. The location page has one clear demo disclosure and a supported Google Maps search URL for the **Tyler Street/Magnolia Avenue intersection**. It does not pin a restaurant or show a purported storefront. The supplied short link could not be resolved in this environment, so it was not used. An in-page Google map or Street View requires a valid Maps Embed API key; none is configured, and no unsupported imagery was added.

## Prepared sync guard and verification

`scripts/prepare-super-tacos-content-sync.mjs` regenerates the local 016, read-only tenant backup export, read-only post-sync verification, and SHA256 manifest. The wrapper requires a separate C.3 approval token, exact Staging target, TLS, a verified fresh backup, and artifact hashes before any connection. The 016 checks the installed 30-item snapshot (six sections, four original groups, ten original options), original item identities/prices/attachments, no open orders, disabled catering notifications, current contact fields, and existing daily hours. It updates only Super Tacos catalog rows and restaurant content, preserves historical item records, and checks other-tenant content hashes before commit. Expected result: 43 retained item rows, 25 active placements/items, 18 retired identities, six sections, nine active groups, and 35 active options. Read-only verification checks every active item, section, attachment, retired placement, image, and fictional contact field.

The first Gate 2 attempt was read-only and stopped when the original transport guard failed. No content SQL has run. A read-only diagnostic through the verified Session Pooler confirmed database postgres, the expected project/host/login and client TLS (\conninfo: TLS 1.3, 256-bit, SSL true). pg_stat_ssl.ssl for pg_backend_pid() was false. That view reports the PostgreSQL backend leg behind PgBouncer, so it cannot attest to client-to-pooler TLS.

The canonical generator now requires the exact Staging direct host plus PostgreSQL-side TLS for direct connections, or the project's exact aws-0-us-east-2.pooler.supabase.com host plus postgres.jjvongzvtnzlvwdfcnjk login for Session Pooler connections. The operator wrapper locks port 5432, resolves `%APPDATA%\postgresql\root.crt`, forces PGSSLMODE=verify-full and PGSSLROOTCERT for both psql calls, and validates the protocol/cipher line from `\conninfo` before passing the client-TLS marker into the guarded SQL. Pooler client TLS therefore remains certificate and hostname verified; direct connections retain the database-side pg_stat_ssl check. The marker is an explicit wrapper contract because PostgreSQL cannot observe the client-to-pooler leg; it must only be supplied after the verified psql preflight. The read-only backup and post-sync operator commands use the same pooler endpoint, project-scoped login, pinned root, verify-full mode, preflight and TLS marker. The artifacts were regenerated locally for review only. No backup export or content sync has succeeded, and no payment, Production, Vercel, or other-tenant setting was changed.

Before any future sync, follow the pinned certificate and connection sequence in `docs/super-tacos-showcase-sprint-c1.md` for the fresh read-only backup, guarded sync, and read-only verification. Retain the backup outside Git and run the existing wrapper to validate its completeness, baseline identities, freshness, and hash before execution. Any target, TLS, backup, artifact, or runtime guard failure remains a stop condition.
