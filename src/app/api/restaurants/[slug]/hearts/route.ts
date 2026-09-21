import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const cookieName = "mm_visitor";
const noStore = { "Cache-Control": "no-store" };
const requestSchema = z.object({ itemId: z.uuid(), liked: z.boolean() });

async function contextFor(slug: string) {
  const { data: restaurant } = await supabaseServer.from("restaurants").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
  return restaurant;
}

function visitor(request: Request) {
  const existing = request.headers.get("cookie")?.split("; ").find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const id = existing && z.uuid().safeParse(existing).success ? existing : randomUUID();
  return { id, key: createHash("sha256").update(id).digest("hex"), fresh: id !== existing };
}

function respond(body: object, visit: ReturnType<typeof visitor>, status = 200) {
  const response = NextResponse.json(body, { status, headers: noStore });
  if (visit.fresh) response.cookies.set(cookieName, visit.id, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const visit = visitor(request);
  const restaurant = await contextFor(slug);
  if (!restaurant) return respond({ error: "Restaurant not found." }, visit, 404);
  const { data, error } = await supabaseServer.from("menu_item_hearts").select("item_id").eq("restaurant_id", restaurant.id).eq("visitor_key", visit.key);
  if (error) return respond({ error: "Hearts could not be loaded." }, visit, 503);
  return respond({ likedItemIds: (data ?? []).map((row) => row.item_id) }, visit);
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const visit = visitor(request);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return respond({ error: "Invalid origin." }, visit, 403);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond({ error: "Invalid heart request." }, visit, 400);
  const restaurant = await contextFor(slug);
  if (!restaurant) return respond({ error: "Restaurant not found." }, visit, 404);
  const { data: menu } = await supabaseServer.from("menus").select("id").eq("restaurant_id", restaurant.id).eq("is_published", true).maybeSingle();
  if (!menu) return respond({ error: "Menu not found." }, visit, 404);
  const { data: placement } = await supabaseServer.from("menu_sections")
    .select("id, menu_section_items!inner(item_id)").eq("menu_id", menu.id).eq("is_active", true)
    .eq("menu_section_items.item_id", parsed.data.itemId).limit(1).maybeSingle();
  if (!placement) return respond({ error: "Item not found." }, visit, 404);
  const { error } = parsed.data.liked
    ? await supabaseServer.from("menu_item_hearts").upsert({ restaurant_id: restaurant.id, item_id: parsed.data.itemId, visitor_key: visit.key }, { onConflict: "restaurant_id,item_id,visitor_key", ignoreDuplicates: true })
    : await supabaseServer.from("menu_item_hearts").delete().eq("restaurant_id", restaurant.id).eq("item_id", parsed.data.itemId).eq("visitor_key", visit.key);
  if (error) return respond({ error: "Heart could not be saved." }, visit, 503);
  const { count, error: countError } = await supabaseServer.from("menu_item_hearts").select("item_id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id).eq("item_id", parsed.data.itemId);
  if (countError) return respond({ error: "Heart count could not be loaded." }, visit, 503);
  return respond({ itemId: parsed.data.itemId, liked: parsed.data.liked, count: count ?? 0 }, visit);
}
