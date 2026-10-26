# Upper Crust hosted media readiness

Reviewed 2026-10-26 against RC `7647988`, using the
[integration report](./upper-crust-staging-rc-integration.md) and
[source packaging report](./upper-crust-v1-source-package.md). No branch inventory
or commerce/dependency investigation was repeated.

**Gate remains open.** The tracing defect is corrected, but publication permission
and protected-hosted access decisions remain outstanding. No media bytes were
copied into the RC, and no local-only restriction was weakened.

## Exact manifest and reconciliation

[upper-crust-hosted-asset-manifest.json](./upper-crust-hosted-asset-manifest.json)
contains a record for each of the 25 missing public-file references and seven
local-media routes, plus the already licensed Boogaloo font as a control. Each
record identifies the current URL, proposed destination, usage, visual necessity,
main/source/RC file presence, byte size, SHA-256, available owner-folder candidates,
provenance evidence and required permission decision. Destination proposals are
not authorization to copy or publish.

| Group | Missing | Essential to preserve approved visuals | Permission disposition |
| --- | ---: | ---: | --- |
| Awning/gallery photographs | 16 | 16 | Publication rights unconfirmed |
| PNG logo, storefront crop, brick texture | 3 | 3 | Supplied/selected, without publication-rights record |
| Google marks (2), Yelp and Tripadvisor marks | 4 | 4 | Third-party brand artwork; reproduction permission/terms unverified |
| Pause SVG | 1 | 0 | Optional non-SVG control path; existing file has Lucide class but no verified license/provenance for its bytes |
| Broadway font | 1 | 0 | Proprietary redistribution not established; CSS declaration has no active font-family use |
| Local-reference JPEGs | 7 | 7 | Explicitly authorized only for local concept review |
| Boogaloo control, already present | 0 | 1 | OFL license and provenance already committed; no correction needed |

All 32 missing references have actual candidate bytes in the source worktree.
Thirty have byte-identical candidates in the main repository. The source-only
exceptions are the Google review-card favicon and Broadway. The current RC has
none of those 32 files. Existing RC social/navigation icons remain unchanged.

The main repository's `public/img/sandwich-shop/front.jpg` is **not** the selected
route image: 221,718 bytes versus 153,050 bytes. Its `storefront.jpg` matches the
source's local-reference `front.jpg`, SHA-256
`f9d86279571c20cf658413a585753cc31ded739240c8a1aab4099b66cb50d814`.
The manifest retains both candidates and hashes to prevent a filename-based swap.

The main repository also keeps the matching logo and brick texture under
`public/img/sandwich-shop/`, whereas active RC URLs point to `img/upper-crust/`.
That path mismatch can be corrected by a byte-identical copy only after permission
is established; it is not evidence of permission itself.

The Google review-card mark was downloaded from Google's favicon endpoint by the
source's local helper. Availability at that endpoint is provenance, not proof of
republication permission. No blanket permission was inferred from owner-supplied
labels, local public folders, prior visual selection, or existing Git history.

## Proposed hosted delivery, not implemented

For these seven fixed photographs, prefer a small **read-only server bundle** over
new storage infrastructure:

1. After rights approval, retain the selected original JPEGs, dimensions, alt text
   and filenames in `media/upper-crust/approved/`, outside `public/`. Together they
   are 1,136,166 bytes. No recompression, generated replacement or image swap is needed.
2. Keep the existing `/r/upper-crust/reference-media/<name>.jpg` URLs. Continue using
   the finite seven-name allowlist, JPEG content type, nosniff, private/no-store,
   noindex and existing unoptimized image rendering. Preserve missing/unknown-file
   404 behavior. Static files outside `public/` avoid an unguarded alternate URL.
3. In a separately approved implementation, explicitly include only these seven
   paths in the media route's function bundle via scoped file tracing/includes,
   and read them using a deployment-relative `process.cwd()` path. Verify the
   generated trace contains exactly those approved media bytes and no local-review
   directory. Keep the existing environment-selected root for local review only.
4. Apply reviewed protected-preview authorization before allowing hosted requests,
   covering pages, media routes, public assets and optimized-image endpoints. The
   current layout/proxy/route still reject Vercel and non-loopback requests. This
   task does not implement that access-policy change or authorize deployment.

Vercel documents [bundling and reading files in functions](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions).
The installed Next.js guide documents route-scoped `outputFileTracingIncludes`.
This architecture needs no database, writable persistent filesystem, credentials,
new dependency or external image host. A protected object store is an alternative
only if future owner-managed uploads justify its extra service/access work.

For the 23 essential public-file references, the proposed destinations preserve
current URLs; publication and protection must cover those static assets too.
Google reviewer avatars, Maps and Yelp widgets remain separate external runtime
dependencies. Their service/display permissions and privacy behavior still need
review; this task neither mirrors nor licenses their remote content.

## Safe correction and validation

The local-only media handler now marks **both** its runtime-only `readFile` and
dynamic `join` argument with `turbopackIgnore`. The installed compiler diagnostics
specifically recommend these per-call annotations. Ignoring only the read removes
one warning but leaves path analysis tracing the project; both are necessary.
These are compiler hints, not a runtime bypass or a global trace exclusion.

The change retains the exact path expression, allowlist, environment/host gates,
filesystem override, response bytes and headers. Reference files are intentionally
not deployment dependencies while their authorization remains local-only. The
future approved hosted bundle must be included explicitly; this fix alone does
not make images available on Vercel.

- Standard Next.js 16.4.2 Turbopack production build, including TypeScript: passed,
  with no tracing warnings after the correction. Build used process-only loopback
  placeholders; no environment file or deployment configuration changed.
- Media route trace: **121 entries**, down from **1,097** in the integrated baseline.
  No source/public/docs/local-media/environment/browser-artifact entries remain.
- Direct route checks: all seven existing source JPEGs served byte-for-byte with
  unchanged JPEG/private/no-store/robots headers. Read-only source access only.
- Twelve cases rejected with 404: missing opt-in, production mode, Vercel markers,
  wrong project URL, public Host, invalid filenames/traversal/prototype keys,
  relative media root and missing file.
- Four existing access/allowlist/hours tests, targeted ESLint and diff checks pass.
  Existing visual/Chrome evidence is reused: no visual component or media bytes
  changed, so no broad regression or repeated Chrome pass was needed.
- No dependency, commerce, checkout, migration, Supabase, other-worktree,
  deployment or push changes. Ignored raw validation output is under
  `.playwright/upper-crust-media-readiness/`.

## Director decisions before closure

Obtain publication authorization covering the exact selected 30 essential assets
(or an explicitly approved scope reduction), settle brand-mark reproduction rights,
and approve protected hosted access plus the scoped seven-file bundle. Keep
Broadway excluded unless a redistribution license is supplied; it is unnecessary
to the current rendered design. The optional pause-image path can remain excluded
or receive a separately reviewed cleanup. Do not treat this report as authorization
to publish the local-reference photographs.
