// One-time local asset preparation. Uses sharp already installed with Next.js.
// Source photographs are never cropped or overwritten.
import sharp from "sharp";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const sourceRoot = process.argv[2];
if (!sourceRoot) throw new Error("Provide the approved Super Tacos asset directory.");
const outputRoot = path.resolve("public/img/super-tacos/approved");
const sources = [
  ["stock/carnitas tacos.jpg", "carnitas-tacos", 2560],
  ["stock/foodiesfeed.com_preparing-mexican-burritos.jpg", "burrito-preparation", 1920],
  ["stock/foodiesfeed.com_tortilla-chips-with-salsa.jpg", "chips-and-salsa", 1920],
  ["stock/salsas.jpg", "salsas", 1920],
  ["stock/StockSnap_UPG7YS3LGW.jpg", "taco-table", 1600],
  ["menu items/carne asada tacos.jpg", "carne-asada-tacos", 1600],
  ["menu items/street tacos.jpg", "street-tacos", 1600],
  ["menu items/burrito.jpg", "burrito", 1600],
  ["menu items/chicken burrito.jpg", "chicken-burrito", 1600],
  ["menu items/black bean burrito.jpg", "black-bean-burrito", 1600],
  ["menu items/breakfast burrito.jpg", "breakfast-burrito", 1600],
  ["menu items/breakfast quesadilla.jpg", "breakfast-quesadilla", 1600],
  ["menu items/churros.jpg", "churros", 1600],
  ["menu items/loaded nachos.jpg", "loaded-nachos", 1600],
  ["menu items/quesadilla.jpg", "quesadilla", 1600],
  ["menu items/shrimp tacos.jpg", "shrimp-tacos", 1600],
  ["menu items/horchata.jpg", "horchata", 1600],
  ["menu items/loaded taquitos.jpg", "loaded-taquitos", 1600],
  ["menu items/Chilaquiles Divorciados.jpg", "chilaquiles", 1600],
  ["menu items/Chorizo Queso Fundido.jpg", "queso-fundido", 1600],
];
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
await mkdir(outputRoot, { recursive: true });
const manifest = [];
for (const [source, name, width] of sources) {
  const original = await readFile(path.join(sourceRoot, source));
  const metadata = await sharp(original).metadata();
  const { data, info } = await sharp(original).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 90, effort: 6 }).toBuffer({ resolveWithObject: true });
  await writeFile(path.join(outputRoot, `${name}.webp`), data);
  manifest.push({ source, originalSha256: sha256(original), originalBytes: original.length, originalDimensions: { width: metadata.width, height: metadata.height },
    asset: `/img/super-tacos/approved/${name}.webp`, sha256: sha256(data), bytes: data.length, width: info.width, height: info.height });
}
await writeFile(path.join(outputRoot, "provenance.json"), JSON.stringify({
  collection: "Owner-supplied approved Super Tacos stock/menu photographs",
  sourceDirectory: "super tacos", sourceArchive: "super tacos.zip", archiveSha256: sha256(await readFile(path.join(sourceRoot, "super tacos.zip"))),
  rights: "Approved by the owner for this showcase. Individual author/license records were not included; no additional license claims are made.",
  processing: "EXIF orientation normalized; uncropped proportional resize; WebP quality 90. Originals preserved in the supplied folder/archive. Earlier sources.json is retained as historical provenance.",
  sharpVersion: sharp.versions.sharp, images: manifest,
}, null, 2) + "\n");
console.log(`Prepared ${manifest.length} uncropped approved images; ${manifest.reduce((sum, image) => sum + image.bytes, 0)} output bytes.`);
