// Owner-supplied portraits only. No downloads; originals remain untouched.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const sourceRoot = process.argv[2];
if (!sourceRoot) throw new Error("Provide the owner-supplied portrait directory.");
const output = "public/img/super-tacos/approved/avatars";
const portraits = [
  ["pexels-alexandru-cojanu-828538450-20592281.jpg", .36, .40, .65],
  ["pexels-divinetechygirl-1181686.jpg", .50, .32, .75],
  ["pexels-enver-gulmez-507867534-16155640.jpg", .60, .47, .75],
  ["pexels-mwaqson-622-3400503-16427475.jpg", .50, .30, .72],
  ["pexels-sbam-29978151.jpg", .50, .37, .85],
];
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
await mkdir(output, { recursive: true });
const images = [];
for (const [index, [source, x, y, scale]] of portraits.entries()) {
  const original = await readFile(path.join(sourceRoot, source));
  const oriented = await sharp(original).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = oriented.info;
  const side = Math.round(Math.min(width, height) * scale);
  const crop = { left: Math.max(0, Math.min(width - side, Math.round(width * x - side / 2))),
    top: Math.max(0, Math.min(height - side, Math.round(height * y - side / 2))), width: side, height: side };
  const data = await sharp(oriented.data).extract(crop).resize(240, 240).webp({ quality: 90 }).toBuffer();
  const asset = `/img/super-tacos/approved/avatars/sample-${index + 1}.webp`;
  await writeFile(`public${asset}`, data);
  images.push({ source, originalSha256: hash(original), originalDimensions: { width, height }, asset,
    sha256: hash(data), bytes: data.length, width: 240, height: 240, focalPoint: { x, y }, crop });
}
await writeFile(`${output}/provenance.json`, JSON.stringify({
  collection: "Owner-supplied illustrative stock portraits", sourceDirectory: "_testimonial profile pictures",
  usage: "Decorative stock portraits. People pictured did not provide the fictional testimonials. Source filenames are provenance, not identities.",
  rights: "Owner supplied; individual license documents were not provided.",
  processing: "Sharp attention crops were attempted and visually inspected. Several missed faces; final explicit focal crops were visually checked in circular masks. Originals preserved. WebP quality 90.",
  images,
}, null, 2) + "\n");
console.log(`Prepared ${images.length} face-centered illustrative portraits.`);
