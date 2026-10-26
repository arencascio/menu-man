# Upper Crust protected Preview V1

This branch's Upper Crust pages are available only on the single Vercel Preview
deployment created from `feature/upper-crust-protected-preview-v1`. App-level
authorization requires all of the following on each request:

- `MENU_MAN_UPPER_CRUST_PREVIEW_ENABLED=true`, scoped to this branch's Preview
  environment.
- `VERCEL=1` and `VERCEL_ENV=preview`.
- `VERCEL_GIT_COMMIT_REF=feature/upper-crust-protected-preview-v1`.
- `NEXT_PUBLIC_SUPABASE_URL=https://jjvongzvtnzlvwdfcnjk.supabase.co`.
- The request Host exactly matches the deployment's `VERCEL_URL`, which must be
  a `.vercel.app` hostname.
- Vercel Deployment Protection must authenticate the visitor through the
  existing project SSO policy. Do not create a shareable protection-bypass URL.

The feature flag only selects a media-safe rendering; it is not an access
credential. Local access continues to require the existing explicit staging
loopback opt-in. Production, other branches, host aliases, non-GET/HEAD page
methods, Upper Crust APIs, and reference-media routes remain denied.

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
node --import=tsx --test src/lib/upper-crust/access.test.ts src/lib/upper-crust/proxy.test.ts src/lib/upper-crust/config.test.ts
```

Responsive browser QA uses Google Chrome via:

```sh
node scripts/qa-upper-crust-protected-preview.mjs
```
