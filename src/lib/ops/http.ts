import { OpsError } from "./access";

export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY",
};
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new OpsError(403, "Submit from the operations website.");
  }
}
export async function boundedBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new OpsError(400, "Request required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new OpsError(413, "Request too long."); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export function opsResponse(status: number, body: object) { return Response.json(body, { status, headers: privateHeaders }); }
export function opsFailure(error: unknown) {
  return error instanceof OpsError ? opsResponse(error.status, { error: error.message })
    : opsResponse(503, { error: "Operation could not be confirmed. Refresh to check its state." });
}
