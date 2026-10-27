# Upper Crust hosted media readiness

Initial readiness was reviewed 2026-10-26 against RC `7647988`, using the
[integration report](./upper-crust-staging-rc-integration.md) and
[source packaging report](./upper-crust-v1-source-package.md). The project owner
added the following authorization on 2026-10-26.

## Owner attestation

The project owner explicitly attests that the rights holder authorized the
original Upper Crust imagery selected in the manifest, and that the Upper Crust
logo was created by the project owner. This approval covers the exact **26
manifest-listed image bytes** used only in the SSO-protected staging Preview:
the logo, storefront crop, brick texture, 16 awning-carousel photographs and
seven local-reference photographs. Their SHA-256 values and protected route
names are recorded in the [asset manifest](./upper-crust-hosted-asset-manifest.json).

This attestation does not authorize production or public release. It does not
cover Google, Yelp or Tripadvisor marks, reviewer quotations/attributions,
reviewer avatars, third-party scripts or embeds, or unrelated content. Those
assets remain excluded; the homepage keeps its Google/Yelp source links.

## Exact manifest and reconciliation

[upper-crust-hosted-asset-manifest.json](./upper-crust-hosted-asset-manifest.json)
contains a record for each of the 25 missing public-file references and seven
local-media routes, plus the already licensed Boogaloo font as a control. Each
record identifies the current URL, proposed destination, usage, visual necessity,
main/source/RC file presence, byte size, SHA-256, available owner-folder candidates,
provenance evidence and required permission decision. Destination proposals are
not authorization to copy or publish.

| Group | Files | Current decision |
| --- | ---: | --- |
| Awning/gallery photographs | 16 | Owner-attested for the protected staging Preview; exact hashes are in the manifest |
| PNG logo, storefront crop, brick texture | 3 | Logo owner-created; imagery owner-attested for the protected staging Preview |
| Local-reference JPEGs | 7 | Owner-attested for the protected staging Preview; exact hashes are in the manifest |
| Google marks (2), Yelp and Tripadvisor marks | 4 | Third-party artwork; terms remain unverified and files remain excluded |
| Pause SVG | 1 | Optional path; provenance remains unverified and file remains excluded |
| Broadway font | 1 | Proprietary redistribution is not established; file remains excluded and font is unused |
| Boogaloo control, already present | 1 | OFL license and provenance are committed |

The 26 owner-attested files are bundled byte-for-byte outside `public/`. The six
remaining absent references are the four unapproved brand marks, optional pause
icon and unused proprietary Broadway font. No third-party artwork or font is
bundled.

The main repository's `public/img/sandwich-shop/front.jpg` is **not** the selected
route image: 221,718 bytes versus 153,050 bytes. Its `storefront.jpg` matches the
source's local-reference `front.jpg`, SHA-256
`f9d86279571c20cf658413a585753cc31ded739240c8a1aab4099b66cb50d814`.
The manifest retains both candidates and hashes to prevent a filename-based swap.

The restored logo, storefront, brick texture and photographs are not copied into
`public/`. Their original public URLs were replaced with `/r/upper-crust/media/`
routes backed by the server-only bundle. The exact source and destination for each
approved file are recorded in the manifest; byte identity is checked by SHA-256.

The Google review-card mark was downloaded from Google's favicon endpoint by the
source's local helper. Availability at that endpoint is provenance, not proof of
republication permission. No blanket permission was inferred from owner-supplied
labels, local public folders, prior visual selection, or existing Git history.

## Protected Preview delivery

The protected Preview uses a read-only server bundle; no storage service or public
media path was added:

1. The exact 26 files live under `media/upper-crust/approved/`, outside `public/`.
   Original bytes, dimensions, alt text and filenames are retained; no recompression,
   generated replacement or image swap is used.
2. The server-only route `/r/upper-crust/media/<allowlisted-name>` serves only the
   finite manifest-backed map. It accepts GET/HEAD and returns the correct image
   type with nosniff, same-origin resource policy, no-referrer, private/no-store
   and noindex headers. Unknown names, invalid paths and missing files return 404.
3. `outputFileTracingIncludes` includes only the approved media directory for that
   route. Build-trace validation checks that the generated trace contains the 26
   approved files and excludes local-review folders and unrelated assets.
4. The route repeats the existing local or protected Preview authorization:
   Preview mode, explicit branch-scoped enablement, the staging Supabase URL, and
   the exact deployment hostname. Vercel SSO remains the outer access control.
   The old `/reference-media/` route stays local-only. Original `/img/...` paths
   and optimized-image requests do not provide alternate access.

Vercel documents [bundling and reading files in functions](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions).
The installed Next.js guide documents route-scoped `outputFileTracingIncludes`.
This architecture needs no database, writable persistent filesystem, credentials,
new dependency or external image host. A protected object store is an alternative
only if future owner-managed uploads justify its extra service/access work.

The six remaining references are the four Google/Yelp/Tripadvisor marks, optional
pause icon and unused proprietary Broadway font. They are not bundled or requested
by the protected Preview. Google reviewer avatars, Maps and Yelp review widgets
are also not rendered or loaded there. Their display permissions and provider terms
remain unresolved; the page keeps only outbound Google/Yelp source links.

## Current focused validation

- The source manifest's 26 owner-attested assets match their recorded SHA-256
  values in the protected bundle; the total bundle is 5,590,692 bytes.
- The route trace contains **26 approved image files** in 148 total trace entries.
  It contains no `.local-reference-media` files or duplicate `public/img` copies.
- All 26 route GETs returned the expected JPEG/PNG/WebP content type, private/no-store
  and noindex headers, and byte hashes matching the manifest. The logo HEAD check
  passed. Unknown media, old local-only routes, public static paths, optimized image
  requests, and Upper Crust order/pickup APIs returned 404.
- Focused access/media/proxy tests pass **15/15**. Targeted ESLint and the Next.js
  16.4.2 Turbopack production build (including TypeScript) pass. Build-time Supabase
  configuration used the exact staging URL and process-only placeholder keys; no
  database operation occurred.
- Google Chrome responsive QA passed **20 route/viewport combinations** across
  320, 390, 768 and 1440px. Homepage, About and Catering photographs and the shop
  window/carousel and filmstrip were visually checked locally. Image advance and
  filmstrip viewer navigation worked. The existing simulated-commerce QA remains
  reused because menu and checkout code are unchanged.
- No external review script, iframe, reviewer avatar, platform mark, public media
  URL or production/database setting was added. Review-specific display remains
  limited to text-only Google/Yelp source links pending separate permission.
