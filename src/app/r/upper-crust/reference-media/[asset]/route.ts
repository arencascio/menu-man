import { readFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { upperCrustLocalAllowed } from "@/lib/upper-crust/access";
import { isUpperCrustReferenceAsset } from "@/lib/upper-crust/reference-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
  if (!upperCrustLocalAllowed(process.env, request.headers.get("host") || "")) return new Response("Not found", { status: 404, headers });
  const { asset } = await params;
  const mediaRoot = process.env.MENU_MAN_UPPER_CRUST_MEDIA_ROOT || join(process.cwd(), ".local-reference-media", "upper-crust");
  if (!isUpperCrustReferenceAsset(asset) || !mediaRoot || !isAbsolute(mediaRoot)) return new Response("Not found", { status: 404, headers });
  try {
    const bytes = await readFile(join(mediaRoot, asset));
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/jpeg" } });
  } catch { return new Response("Not found", { status: 404, headers }); }
}
