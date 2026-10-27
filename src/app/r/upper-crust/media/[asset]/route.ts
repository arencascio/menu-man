import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { upperCrustProtectedMediaRequestAllowed } from "@/lib/upper-crust/access";
import { getUpperCrustProtectedMedia } from "@/lib/upper-crust/protected-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ asset: string }> };

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function mediaFile(file: string) {
  return join(/* turbopackIgnore: true */ process.cwd(), "media", "upper-crust", "approved", file);
}

function notFound() {
  return new Response("Not found", { status: 404, headers: privateHeaders });
}

async function resolveAsset(request: Request, context: RouteContext) {
  const host = request.headers.get("host") || "";
  if (!upperCrustProtectedMediaRequestAllowed(process.env, host, new URL(request.url).pathname, request.method)) return undefined;
  const { asset } = await context.params;
  return getUpperCrustProtectedMedia(asset);
}

export async function GET(request: Request, context: RouteContext) {
  const asset = await resolveAsset(request, context);
  if (!asset) return notFound();

  try {
    const bytes = await readFile(/* turbopackIgnore: true */ mediaFile(asset.file));
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Type": asset.contentType,
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch {
    return notFound();
  }
}

export async function HEAD(request: Request, context: RouteContext) {
  const asset = await resolveAsset(request, context);
  if (!asset) return notFound();
  try {
    const fileInfo = await stat(/* turbopackIgnore: true */ mediaFile(asset.file));
    return new Response(null, {
      status: 200,
      headers: { ...privateHeaders, "Content-Type": asset.contentType, "Content-Length": String(fileInfo.size) },
    });
  } catch {
    return notFound();
  }
}
