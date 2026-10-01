import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { heartCookieFrom, heartOriginAllowed, heartSource, heartTargetStatus, heartVisitor, heartWindowMs } from "@/lib/menu-engagement/heart-security";
import { mutateHeart, type HeartStore } from "@/lib/menu-engagement/heart-mutation";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const requestSchema = z.object({ itemId: z.uuid(), liked: z.boolean() });

function heartSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing server heart signing secret.");
  return `menu-man-heart-visitor-v1:${secret}`;
}

function visitor(request: Request) {
  return heartVisitor(heartCookieFrom(request), heartSecret());
}

function respond(body: object, visit: ReturnType<typeof visitor> | null, status = 200, retry = false) {
  const response = NextResponse.json(body, { status, headers: { ...noStore, ...(retry ? { "X-Heart-Visitor-Refresh": "1" } : {}) } });
  if (visit?.fresh) response.cookies.set("mm_visitor", visit.cookie, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL_ENV),
    path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

async function contextFor(slug: string) {
  const { data: restaurant } = await supabaseServer.from("restaurants").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
  return restaurant;
}

const heartStore: HeartStore = {
  async has(restaurantId, itemId, visitorKey) {
    const { data, error } = await supabaseServer.from("menu_item_hearts").select("item_id")
      .eq("restaurant_id", restaurantId).eq("item_id", itemId).eq("visitor_key", visitorKey).maybeSingle();
    if (error) throw error;
    return Boolean(data);
  },
  async recent(restaurantId, itemId) {
    const since = new Date(Date.now() - heartWindowMs).toISOString();
    const { count, error } = await supabaseServer.from("menu_item_hearts")
      .select("item_id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("item_id", itemId).gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  },
  async add(restaurantId, itemId, visitorKey) {
    const { error } = await supabaseServer.from("menu_item_hearts")
      .upsert({ restaurant_id: restaurantId, item_id: itemId, visitor_key: visitorKey },
        { onConflict: "restaurant_id,item_id,visitor_key", ignoreDuplicates: true });
    if (error) throw error;
  },
  async remove(restaurantId, itemId, visitorKey) {
    const { error } = await supabaseServer.from("menu_item_hearts").delete()
      .eq("restaurant_id", restaurantId).eq("item_id", itemId).eq("visitor_key", visitorKey);
    if (error) throw error;
  },
  async count(restaurantId, itemId) {
    const { count, error } = await supabaseServer.from("menu_item_hearts")
      .select("item_id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("item_id", itemId);
    if (error) throw error;
    return count ?? 0;
  },
};

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
  if (!heartOriginAllowed(request)) return respond({ error: "Invalid origin." }, null, 403);
  const visit = visitor(request);
  if (visit.fresh) return respond({ error: "Visitor identity refreshed." }, visit, 428, true);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond({ error: "Invalid heart request." }, visit, 400);
  const { slug } = await params;
  const restaurant = await contextFor(slug);
  if (!restaurant) return respond({ error: "Restaurant not found." }, visit, 404);
  const target = await heartTargetStatus(restaurant.id, parsed.data.itemId,
    async (restaurantId) => {
      const { data } = await supabaseServer.from("menus").select("id").eq("restaurant_id", restaurantId).eq("is_published", true).maybeSingle();
      return data?.id ?? null;
    },
    async (menuId, itemId) => {
      const { data } = await supabaseServer.from("menu_sections")
        .select("id, menu_section_items!inner(item_id)").eq("menu_id", menuId).eq("is_active", true)
        .eq("menu_section_items.item_id", itemId).limit(1).maybeSingle();
      return Boolean(data);
    });
  if (target === "no-menu") return respond({ error: "Menu not found." }, visit, 404);
  if (target === "no-item") return respond({ error: "Item not found." }, visit, 404);
  try {
    const result = await mutateHeart(heartStore, { restaurantId: restaurant.id, itemId: parsed.data.itemId,
      visitorKey: visit.key, sourceKey: heartSource(request, heartSecret()), liked: parsed.data.liked });
    return respond(result.body, visit, result.status);
  } catch {
    return respond({ error: "Heart could not be saved." }, visit, 503);
  }
}
