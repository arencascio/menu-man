import { readFile } from "node:fs/promises";
import process from "node:process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ImportItem = {
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  sortOrder: number;
};

type ImportSection = {
  name: string;
  description: string | null;
  sortOrder: number;
  items: ImportItem[];
};

type ImportDocument = {
  restaurantSlug: string;
  menuName: string;
  sections: ImportSection[];
};

type CsvRow = Record<string, string>;

const usage = `Usage:
  npm run import-menu -- --file path/to/menu.json [--dry-run]
  npm run import-menu -- --file path/to/menu.csv [--dry-run]

JSON shape:
  { restaurantSlug, menuName, sections: [{ name, description, sortOrder, items: [{ name, description, priceCents, imageUrl, sortOrder }] }] }

CSV headers:
  restaurantSlug,menuName,sectionName,sectionDescription,sectionSortOrder,itemName,itemDescription,priceCents,imageUrl,itemSortOrder`;

function fail(message: string): never {
  throw new Error(message);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") fail(`${label} must be a string or null`);
  return value.trim() || null;
}

function requiredInteger(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    fail(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function parseCsvLine(line: string, lineNumber: number): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) fail(`CSV line ${lineNumber} has an unterminated quoted value`);
  values.push(value.trim());
  return values;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) fail("CSV must contain a header and at least one data row");

  const headers = parseCsvLine(lines[0], 1);
  const requiredHeaders = [
    "restaurantSlug", "menuName", "sectionName", "sectionDescription",
    "sectionSortOrder", "itemName", "itemDescription", "priceCents",
    "imageUrl", "itemSortOrder",
  ];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) fail(`CSV is missing required headers: ${missingHeaders.join(", ")}`);

  return lines.slice(1).map((line, offset) => {
    const lineNumber = offset + 2;
    const values = parseCsvLine(line, lineNumber);
    if (values.length !== headers.length) {
      fail(`CSV line ${lineNumber} has ${values.length} values; expected ${headers.length}`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function normalizeJson(input: unknown): ImportDocument {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("JSON root must be an object with restaurantSlug, menuName, and sections");
  }
  const document = input as Record<string, unknown>;
  if (!Array.isArray(document.sections)) fail("JSON sections must be an array");

  return {
    restaurantSlug: requiredString(document.restaurantSlug, "restaurantSlug"),
    menuName: requiredString(document.menuName, "menuName"),
    sections: document.sections.map((rawSection, sectionIndex) => {
      if (!rawSection || typeof rawSection !== "object") fail(`sections[${sectionIndex}] must be an object`);
      const section = rawSection as Record<string, unknown>;
      if (!Array.isArray(section.items)) fail(`sections[${sectionIndex}].items must be an array`);
      return {
        name: requiredString(section.name, `sections[${sectionIndex}].name`),
        description: optionalString(section.description, `sections[${sectionIndex}].description`),
        sortOrder: requiredInteger(section.sortOrder, `sections[${sectionIndex}].sortOrder`),
        items: section.items.map((rawItem, itemIndex) => {
          if (!rawItem || typeof rawItem !== "object") fail(`sections[${sectionIndex}].items[${itemIndex}] must be an object`);
          const item = rawItem as Record<string, unknown>;
          return {
            name: requiredString(item.name, `sections[${sectionIndex}].items[${itemIndex}].name`),
            description: optionalString(item.description, `sections[${sectionIndex}].items[${itemIndex}].description`),
            priceCents: requiredInteger(item.priceCents, `sections[${sectionIndex}].items[${itemIndex}].priceCents`),
            imageUrl: optionalString(item.imageUrl, `sections[${sectionIndex}].items[${itemIndex}].imageUrl`),
            sortOrder: requiredInteger(item.sortOrder, `sections[${sectionIndex}].items[${itemIndex}].sortOrder`),
          };
        }),
      };
    }),
  };
}

function normalizeCsv(rows: CsvRow[]): ImportDocument {
  const firstRow = rows[0];
  const sections = new Map<string, ImportSection>();

  for (const [index, row] of rows.entries()) {
    const rowLabel = `CSV row ${index + 2}`;
    if (row.restaurantSlug !== firstRow.restaurantSlug) fail(`${rowLabel} has a different restaurantSlug`);
    if (row.menuName !== firstRow.menuName) fail(`${rowLabel} has a different menuName`);
    const sectionName = requiredString(row.sectionName, `${rowLabel}.sectionName`);
    const sectionKey = `${sectionName}\u0000${row.sectionSortOrder}`;
    const section = sections.get(sectionKey) || {
      name: sectionName,
      description: optionalString(row.sectionDescription, `${rowLabel}.sectionDescription`),
      sortOrder: requiredInteger(row.sectionSortOrder, `${rowLabel}.sectionSortOrder`),
      items: [],
    };
    if (section.description !== optionalString(row.sectionDescription, `${rowLabel}.sectionDescription`)) {
      fail(`${rowLabel} has a conflicting sectionDescription for ${sectionName}`);
    }
    section.items.push({
      name: requiredString(row.itemName, `${rowLabel}.itemName`),
      description: optionalString(row.itemDescription, `${rowLabel}.itemDescription`),
      priceCents: requiredInteger(row.priceCents, `${rowLabel}.priceCents`),
      imageUrl: optionalString(row.imageUrl, `${rowLabel}.imageUrl`),
      sortOrder: requiredInteger(row.itemSortOrder, `${rowLabel}.itemSortOrder`),
    });
    sections.set(sectionKey, section);
  }

  return {
    restaurantSlug: requiredString(firstRow.restaurantSlug, "CSV restaurantSlug"),
    menuName: requiredString(firstRow.menuName, "CSV menuName"),
    sections: [...sections.values()],
  };
}

function validateDocument(document: ImportDocument) {
  const sectionNames = new Set<string>();
  const itemKeys = new Set<string>();

  if (document.sections.length === 0) fail("Import must contain at least one section");
  for (const section of document.sections) {
    const normalizedName = section.name.toLowerCase();
    if (sectionNames.has(normalizedName)) fail(`Duplicate section name: ${section.name}`);
    sectionNames.add(normalizedName);
    if (section.items.length === 0) fail(`Section has no items: ${section.name}`);

    for (const item of section.items) {
      const itemKey = `${normalizedName}\u0000${item.name.toLowerCase()}`;
      if (itemKeys.has(itemKey)) fail(`Duplicate item placement: ${section.name} / ${item.name}`);
      itemKeys.add(itemKey);
    }
  }
}

async function loadDocument(filePath: string): Promise<ImportDocument> {
  const source = await readFile(filePath, "utf8");
  if (filePath.toLowerCase().endsWith(".csv")) return normalizeCsv(parseCsv(source));
  try {
    return normalizeJson(JSON.parse(source));
  } catch (error) {
    if (error instanceof SyntaxError) fail(`Invalid JSON: ${error.message}`);
    throw error;
  }
}

async function check<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>, operation: string): Promise<T> {
  const { data, error } = await promise;
  if (error) fail(`${operation}: ${error.message}`);
  return data;
}

async function findOne(client: SupabaseClient, table: string, filters: Record<string, string>, operation: string) {
  let query = client.from(table).select("*");
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { data, error } = await query.maybeSingle();
  if (error) fail(`${operation}: ${error.message}`);
  return data;
}

async function importDocument(document: ImportDocument, dryRun: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const restaurant = await findOne(client, "restaurants", { slug: document.restaurantSlug }, "Find restaurant");
  if (!restaurant || !restaurant.is_active) fail(`Active restaurant not found for slug: ${document.restaurantSlug}`);
  const existingMenu = await findOne(client, "menus", { restaurant_id: restaurant.id, name: document.menuName }, "Find menu");
  if (dryRun) {
    console.log(`Dry run: ${document.sections.length} sections and ${document.sections.reduce((sum, section) => sum + section.items.length, 0)} items validated for ${document.restaurantSlug}/${document.menuName}.`);
    return;
  }

  const menu = existingMenu
    ? await check(client.from("menus").update({ name: document.menuName, is_published: true }).eq("id", existingMenu.id).select("*").single(), "Update menu")
    : await check(client.from("menus").insert({ restaurant_id: restaurant.id, name: document.menuName, is_published: true }).select("*").single(), "Create menu");

  for (const sectionInput of [...document.sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const existingSection = await findOne(client, "menu_sections", { menu_id: menu.id, name: sectionInput.name }, "Find section");
    const section = existingSection
      ? await check(client.from("menu_sections").update({ description: sectionInput.description, sort_order: sectionInput.sortOrder, is_active: true }).eq("id", existingSection.id).select("*").single(), "Update section")
      : await check(client.from("menu_sections").insert({ menu_id: menu.id, name: sectionInput.name, description: sectionInput.description, sort_order: sectionInput.sortOrder, is_active: true }).select("*").single(), "Create section");

    for (const itemInput of [...sectionInput.items].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const existingItem = await findOne(client, "menu_items", { name: itemInput.name }, "Find menu item");
      const item = existingItem
        ? await check(client.from("menu_items").update({ description: itemInput.description, price_cents: itemInput.priceCents, image_url: itemInput.imageUrl }).eq("id", existingItem.id).select("*").single(), "Update menu item")
        : await check(client.from("menu_items").insert({ name: itemInput.name, description: itemInput.description, price_cents: itemInput.priceCents, image_url: itemInput.imageUrl }).select("*").single(), "Create menu item");
      const placement = await findOne(client, "menu_section_items", { menu_section_id: section.id, menu_item_id: item.id }, "Find placement");
      if (placement) {
        await check(client.from("menu_section_items").update({ sort_order: itemInput.sortOrder }).eq("id", placement.id), "Update placement");
      } else {
        await check(client.from("menu_section_items").insert({ menu_section_id: section.id, menu_item_id: item.id, sort_order: itemInput.sortOrder }), "Create placement");
      }
    }
  }
  console.log(`Imported ${document.sections.length} sections for ${document.restaurantSlug}/${document.menuName}.`);
}

async function main() {
  const fileIndex = process.argv.indexOf("--file");
  const filePath = fileIndex >= 0 ? process.argv[fileIndex + 1] : undefined;
  if (process.argv.includes("--help")) {
    console.log(usage);
    return;
  }
  if (!filePath) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }
  const document = await loadDocument(filePath);
  validateDocument(document);
  await importDocument(document, process.argv.includes("--dry-run"));
}

main().catch((error: unknown) => {
  console.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});