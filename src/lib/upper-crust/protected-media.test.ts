import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getUpperCrustProtectedMedia, upperCrustProtectedMedia, upperCrustProtectedMediaUrl } from "./protected-media";

type AssetRecord = {
  currentUrl: string;
  preferredSha256: string;
  proposedDestination: string;
};

type SupplementalAssetRecord = { key: string; file: string; bytes: number; sha256: string };
const manifest = JSON.parse(readFileSync(resolve("docs/upper-crust-hosted-asset-manifest.json"), "utf8")) as {
  assets: AssetRecord[];
  supplementalPreviewAssets: SupplementalAssetRecord[];
};
const approvedManifestAssets = manifest.assets.filter(({ currentUrl }) =>
  /storefront-crop|upper-crust\.png|brickwall2|awning-carousel|reference-media/.test(currentUrl),
);

test("protected media allowlist matches the 26 owner-approved manifest assets byte-for-byte", () => {
  assert.equal(approvedManifestAssets.length, 26);
  assert.equal(Object.keys(upperCrustProtectedMedia).length, approvedManifestAssets.length + 2 + manifest.supplementalPreviewAssets.length);

  for (const asset of approvedManifestAssets) {
    const key = asset.currentUrl.split("/").pop()!;
    const entry = getUpperCrustProtectedMedia(key);
    assert.ok(entry, `missing protected route key for ${asset.currentUrl}`);
    assert.equal(asset.proposedDestination, `media/upper-crust/approved/${entry.file}`, asset.currentUrl);

    const bytes = readFileSync(resolve(asset.proposedDestination));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(sha256, asset.preferredSha256, asset.currentUrl);
  }

  for (const asset of manifest.supplementalPreviewAssets) {
    assert.equal(getUpperCrustProtectedMedia(asset.key)?.file, asset.file, asset.key);
    const bytes = readFileSync(resolve(`media/upper-crust/approved/${asset.file}`));
    assert.equal(bytes.length, asset.bytes, asset.key);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256.toLowerCase(), asset.key);
  }
});

test("media URLs are route-scoped and safely encode original filenames", () => {
  assert.equal(upperCrustProtectedMediaUrl("chicken salad.jpg"), "/r/upper-crust/media/chicken%20salad.jpg");
  assert.equal(upperCrustProtectedMediaUrl("Veggie sandwich and tomato florentine soup.jpg"), "/r/upper-crust/media/Veggie%20sandwich%20and%20tomato%20florentine%20soup.jpg");
  assert.throws(() => upperCrustProtectedMediaUrl("../.env"), /Unapproved Upper Crust media key/);
});

test("provider branding is manifest-listed, hash-pinned and protected", () => {
  const branding = JSON.parse(readFileSync("docs/upper-crust-provider-branding.json", "utf8")) as { assets: {key:string; file:string; sha256:string; permission:string}[] };
  assert.equal(branding.assets.length, 5);
  for (const asset of branding.assets) {
    assert.equal(getUpperCrustProtectedMedia(asset.key)?.file, asset.file);
    assert.ok(asset.permission);
    assert.equal(createHash("sha256").update(readFileSync(resolve("media/upper-crust/approved", asset.file))).digest("hex"), asset.sha256);
  }
});
