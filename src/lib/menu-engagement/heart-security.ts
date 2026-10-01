import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

const version = "v1";
const windowMs = 10 * 60 * 1000;
const sourceLimit = 20;
const visitorLimit = 40;
export const recentItemLimit = 100;
export const heartWindowMs = windowMs;

export function heartVisitor(cookie: string | undefined, secret: string): { cookie: string; key: string; fresh: boolean } {
  const parts = cookie?.split(".");
  if (parts?.length === 3 && parts[0] === version && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(parts[1])) {
    const id = parts[1];
    const expected = createHmac("sha256", secret).update(`${version}.${id}`).digest();
    const supplied = /^[A-Za-z0-9_-]{43}$/.test(parts[2]) ? Buffer.from(parts[2], "base64url") : Buffer.alloc(0);
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) {
      return { cookie: `${version}.${id}.${parts[2]}`, key: createHash("sha256").update(id).digest("hex"), fresh: false };
    }
  }
  const id = randomUUID();
  const signature = createHmac("sha256", secret).update(`${version}.${id}`).digest("base64url");
  return { cookie: `${version}.${id}.${signature}`, key: createHash("sha256").update(id).digest("hex"), fresh: true };
}

export function heartCookieFrom(request: Request) {
  const part = request.headers.get("cookie")?.split(";").map((value) => value.trim()).find((value) => value.startsWith("mm_visitor="));
  return part?.slice("mm_visitor=".length);
}

export function heartOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

// Vercel overwrites this header at its edge. Never trust a client-supplied value locally.
export function heartSource(request: Request, secret: string, vercelEnv = process.env.VERCEL_ENV) {
  if (vercelEnv !== "preview" && vercelEnv !== "production") return null;
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip && isIP(ip) ? createHmac("sha256", secret).update(`heart-source:${ip}`).digest("hex") : null;
}

type WindowCount = { start: number; count: number };
export function createHeartLimiter(now = () => Date.now()) {
  const counts = new Map<string, WindowCount>();
  return (visitorKey: string, sourceKey: string | null, restaurantId: string, itemId: string) => {
    const at = now();
    for (const [key, value] of counts) if (at - value.start >= windowMs) counts.delete(key);
    const keys: [string, number][] = [[`visitor:${visitorKey}:${restaurantId}`, visitorLimit]];
    if (sourceKey) keys.push([`source:${sourceKey}:${restaurantId}:${itemId}`, sourceLimit]);
    if (keys.some(([key, limit]) => (counts.get(key)?.count ?? 0) >= limit)) return false;
    if (counts.size + keys.length > 10_000) return false;
    for (const [key] of keys) {
      const current = counts.get(key);
      counts.set(key, { start: current?.start ?? at, count: (current?.count ?? 0) + 1 });
    }
    return true;
  };
}

export const allowHeart = createHeartLimiter();

export async function heartTargetStatus(
  restaurantId: string,
  itemId: string,
  findPublishedMenu: (restaurantId: string) => Promise<string | null>,
  hasActivePlacement: (menuId: string, itemId: string) => Promise<boolean>,
) {
  const menuId = await findPublishedMenu(restaurantId);
  if (!menuId) return "no-menu" as const;
  return await hasActivePlacement(menuId, itemId) ? "valid" as const : "no-item" as const;
}

export function heartVoteAllowed(input: {
  liked: boolean;
  existing: boolean;
  recent: number;
  visitorKey: string;
  sourceKey: string | null;
  restaurantId: string;
  itemId: string;
}, limiter = allowHeart) {
  if (!input.liked || input.existing) return true;
  return input.recent < recentItemLimit && limiter(input.visitorKey, input.sourceKey, input.restaurantId, input.itemId);
}
