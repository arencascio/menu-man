This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Menu imports

Import a structured menu with the service-role key:

```bash
npm run import-menu -- --file ./menu.json --dry-run
npm run import-menu -- --file ./menu.json
npm run audit-images -- --restaurant armandos
npm run import-images -- --restaurant armandos --folder ./images/armandos --dry-run
```

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
