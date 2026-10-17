// Only deployed Vercel ingress supplies trusted geolocation. Local/self-hosted
// requests must fail closed, even if a caller supplies Vercel-looking headers.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const trustedIngress = process.env.VERCEL === "1"
    && ["production", "preview"].includes(process.env.VERCEL_ENV ?? "");
  const allowed = trustedIngress && request.headers.get("x-vercel-ip-country") === "US";
  return Response.json({ allowed }, { headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
  } });
}
