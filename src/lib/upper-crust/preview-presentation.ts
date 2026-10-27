import { upperCrustPreviewPresentation } from "./access";

// Server-only rendering switch for the protected Preview. It never authorizes
// a request; media access is independently gated by the server route and proxy.
export function isUpperCrustPreviewPresentation() {
  return upperCrustPreviewPresentation(process.env);
}
