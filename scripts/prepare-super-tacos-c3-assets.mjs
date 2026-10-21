// Local asset preparation only; originals stay in the owner's folder.
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const sourceRoot = process.argv[2];
if (!sourceRoot) throw new Error("Provide the approved Super Tacos asset directory.");
const outputRoot = path.resolve("public/img/super-tacos/approved");
const provenancePath = path.join(outputRoot, "provenance.json");
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
const sources = [
  ["sopes.jpg", "sopes"],
  ["Huevos Divorciados.jpg", "huevos-divorciados"],
  ["ranchero plate.jpg", "ranchero-plate"],
  ["fish_taco.jpg", "fish-taco"],
  ["menudo.jpg", "menudo"],
  ["mexican coke half liter.jpg", "mexican-coke"],
  ["shrimp cocktail.jpg", "shrimp-cocktail"],
  ["tortillas.jpg", "tortillas"],
  ["super taco.jpg", "super-taco"],
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const [file, name] of sources) {
  const original = await readFile(path.join(sourceRoot, "menu items", file));
  const metadata = await sharp(original).metadata();
  const { data, info } = await sharp(original).rotate().resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 90, effort: 6 }).toBuffer({ resolveWithObject: true });
  await writeFile(path.join(outputRoot, `${name}.webp`), data);
  provenance.images = provenance.images.filter((entry) => entry.asset !== `/img/super-tacos/approved/${name}.webp`);
  provenance.images.push({ source: `menu items/${file}`, originalSha256: hash(original), originalBytes: original.length,
    originalDimensions: { width: metadata.width, height: metadata.height },
    asset: `/img/super-tacos/approved/${name}.webp`, sha256: hash(data), bytes: data.length,
    width: info.width, height: info.height });
}
await writeFile(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
console.log(`Prepared ${sources.length} approved photos.`);
