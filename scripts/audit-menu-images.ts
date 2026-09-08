import process from "node:process";
import { createClient } from "@supabase/supabase-js";

type ImageRecord = {
  name: string;
  source_system: string | null;
  source_item_id: string | null;
  source_image_url: string | null;
  image_path: string | null;
};

function fail(message: string): never {
  throw new Error(message);
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const restaurantSlug = getArg("--restaurant");
  const format = getArg("--format") || "text";
  if (!restaurantSlug || !["text", "json"].includes(format)) {
    console.log("Usage: npm run audit-images -- --restaurant armandos [--format text|json]");
    process.exitCode = 1;
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const restaurantResult = await client.from("restaurants").select("id, name, slug").eq("slug", restaurantSlug).single();
  if (restaurantResult.error || !restaurantResult.data) fail(`Restaurant lookup failed: ${restaurantResult.error?.message || restaurantSlug}`);

  const itemsResult = await client
    .from("menu_items")
    .select("name, source_system, source_item_id, source_image_url, image_path")
    .eq("restaurant_id", restaurantResult.data.id)
    .order("name", { ascending: true });
  if (itemsResult.error) fail(`Menu item lookup failed: ${itemsResult.error.message}`);

  const records = (itemsResult.data || []) as ImageRecord[];
  if (format === "json") {
    console.log(JSON.stringify({ restaurant: restaurantResult.data, items: records }, null, 2));
    return;
  }

  console.log(`Image audit: ${restaurantResult.data.name} (${restaurantSlug})`);
  console.log(`Items: ${records.length}`);
  console.log("name | source_system | source_item_id | owned_image_path | source_image_url | missing");
  for (const item of records) {
    const missing = !item.image_path && !item.source_image_url;
    console.log([
      item.name,
      item.source_system || "",
      item.source_item_id || "",
      item.image_path || "",
      item.source_image_url || "",
      missing ? "yes" : "no",
    ].join(" | "));
  }
}

main().catch((error: unknown) => {
  console.error(`Image audit failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
