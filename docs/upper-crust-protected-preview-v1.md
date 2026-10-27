# Upper Crust protected Preview access

Upper Crust pages and approved media are available only on deployment-specific
Vercel Previews from these branches: `feature/upper-crust-protected-preview-v1`,
`feature/upper-crust-original-media-v1` and canonical `staging`. App-level
authorization requires all of the following on each page or media request:

- `MENU_MAN_UPPER_CRUST_PREVIEW_ENABLED=true`, scoped to this branch's Preview
  environment.
- `VERCEL=1` and `VERCEL_ENV=preview`.
- `VERCEL_GIT_COMMIT_REF` exactly matches an allowlisted branch above.
- `NEXT_PUBLIC_SUPABASE_URL=https://jjvongzvtnzlvwdfcnjk.supabase.co`.
- The request Host exactly matches the deployment's `VERCEL_URL`, which must be
  a `.vercel.app` hostname.
- Vercel Deployment Protection must authenticate the visitor through the
  existing project SSO policy. Do not create a shareable protection-bypass URL.

The feature flag selects the Preview presentation; it is not an access
credential. Local access continues to require the existing explicit staging
loopback opt-in. Production, other branches, host aliases and non-GET/HEAD
requests remain denied. Upper Crust order and availability APIs remain denied.

Vercel project `menu-man` uses branch-scoped Preview variables for the media
feature branch and canonical staging: `MENU_MAN_UPPER_CRUST_PREVIEW_ENABLED=true`
and `NEXT_PUBLIC_SUPABASE_URL=https://jjvongzvtnzlvwdfcnjk.supabase.co`. The
original protected-preview feature branch keeps its existing settings.
Deployment Protection remains SSO-enabled for all except custom domains. No
protection or bypass settings were changed, and no bypass URL was created.

The 26 owner-attested logo, storefront, brick and photo assets are stored in the
server-only `media/upper-crust/approved/` bundle and served through the finite
`/r/upper-crust/media/<asset>` route. Only exact allowlisted GET/HEAD requests
pass the same Preview branch/database/host guard. Responses are private/no-store,
noindex, same-origin and nosniff. No copies are placed in `public/`, and
Next.js image optimization requests for these assets are denied. The separate
`/reference-media/` handler stays local-only. Google/Yelp/Tripadvisor marks,
review text/attribution, reviewer avatars and third-party embeds are not part of
this authorization; the hosted homepage retains only text source links.

Upper Crust menu items remain non-orderable fixture data. Checkout uses the
existing client-side sample receipt and cannot create a persisted order or
payment. The preview does not load the owner's local-only photo folder,
unlicensed public food/storefront photography, the logo, third-party reviews,
maps, or social marks. It uses a neutral storefront placeholder, CSS awning,
text branding, and the existing OFL-licensed Boogaloo menu font. Heading text
uses the Georgia fallback because hosted rights for the previous remote font
were not established.

Focused tests:

```sh
node --import=tsx --test src/lib/upper-crust/access.test.ts src/lib/upper-crust/proxy.test.ts src/lib/upper-crust/protected-media.test.ts src/lib/upper-crust/config.test.ts
```

Responsive browser QA uses Google Chrome via:

```sh
node scripts/qa-upper-crust-protected-preview.mjs
```
