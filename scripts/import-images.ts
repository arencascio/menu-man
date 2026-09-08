import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const bucket = "restaurant-assets";
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

type MenuItem = {
  id: string;
  name: string;
  source_system: string | null;
  source_item_id: string | null;
  image_path: string | null;
};

type LocalImage = {
  filePath: string;
  fileName: string;
  sourceItemId: string;
  extension: string;
};

function fail(message: string): never {
  throw new Error(message);
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function contentType(extension: string): string {
  return extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : `image/${extension.slice(1)}`;
}

async function collectImages(folder: string): Promise<LocalImage[]> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const fileName = entry.name;
      const extension = path.extname(fileName).toLowerCase();
      return {
        filePath: path.join(entry.parentPath, fileName),
        fileName,
        sourceItemId: path.basename(fileName, extension).replace(/^doordash[_-]/i, ""),
        extension,
      };
    })
    .filter((image) => allowedExtensions.has(image.extension));
}

async function main() {
  const restaurantSlug = getArg("--restaurant");
  const folder = getArg("--folder");
  const dryRun = process.argv.includes("--dry-run");
  const replace = process.argv.includes("--replace");
  if (!restaurantSlug || !folder) {
    console.log("Usage: npm run import-images -- --restaurant armandos --folder ./images/armandos [--dry-run] [--replace]");
    process.exitCode = 1;
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const restaurantResult = await client.from("restaurants").select("id, name").eq("slug", restaurantSlug).single();
  if (restaurantResult.error || !restaurantResult.data) fail(`Restaurant lookup failed: ${restaurantResult.error?.message || restaurantSlug}`);

  const itemsResult = await client
    .from("menu_items")
    .select("id, name, source_system, source_item_id, image_path")
    .eq("restaurant_id", restaurantResult.data.id)
    .not("source_item_id", "is", null);
  if (itemsResult.error) fail(`Menu item lookup failed: ${itemsResult.error.message}`);

  const localImages = await collectImages(folder);
  const items = (itemsResult.data || []) as MenuItem[];
  const matchedItemIds = new Set<string>();
  const unmatchedFiles: string[] = [];
  const failures: string[] = [];
  let uploaded = 0;
  let replaced = 0;
  let skippedExisting = 0;

  for (const image of localImages) {
    const matchingItems = items.filter((item) => item.source_item_id === image.sourceItemId);
    const item = matchingItems.length === 1 ? matchingItems[0] : matchingItems.find((candidate) => candidate.source_system === "doordash");
    if (!item) {
      unmatchedFiles.push(image.fileName);
      continue;
    }
    if (item.image_path && !replace) {
      skippedExisting += 1;
      matchedItemIds.add(item.id);
      continue;
    }

    const storagePath = `restaurants/${restaurantResult.data.id}/menu-items/${item.id}/main${image.extension}`;
    if (dryRun) {
      if (item.image_path) replaced += 1;
      else uploaded += 1;
      matchedItemIds.add(item.id);
      continue;
    }

    try {
      const contents = await readFile(image.filePath);
      const uploadResult = await client.storage.from(bucket).upload(storagePath, contents, {
        contentType: contentType(image.extension),
        upsert: replace,
      });
      if (uploadResult.error) throw new Error(uploadResult.error.message);
      const updateResult = await client.from("menu_items").update({ image_path: storagePath }).eq("id", item.id);
      if (updateResult.error) throw new Error(updateResult.error.message);
      if (item.image_path) replaced += 1;
      else uploaded += 1;
      matchedItemIds.add(item.id);
    } catch (error) {
      failures.push(`${image.fileName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const missingItems = items.filter((item) => !matchedItemIds.has(item.id)).map((item) => `${item.name} (${item.source_system}:${item.source_item_id})`);
  console.log(JSON.stringify({
    restaurant: restaurantSlug,
    dryRun,
    replace,
    localFiles: localImages.length,
    uploaded,
    replaced,
    skippedExisting,
    unmatchedFiles,
    missingItems,
    failures,
  }, null, 2));

  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`Image import failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
