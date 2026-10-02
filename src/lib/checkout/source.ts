import { createHmac } from "node:crypto";
import { isIP } from "node:net";

// Vercel replaces this header at its edge; untrusted local headers are ignored.
export function checkoutSource(
  request: Request,
  restaurantSlug: string,
  secret: string | undefined,
  vercelEnv = process.env.VERCEL_ENV,
): string | null {
  if ((vercelEnv !== "preview" && vercelEnv !== "production") || !secret) return null;
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (!ip || !isIP(ip)) return null;
  return createHmac("sha256", secret)
    .update(`checkout-source:v1:${restaurantSlug}:${ip}`)
    .digest("hex");
}
