import { upperCrustPreviewPresentation } from "./access";

// Server-only rendering switch. It omits source imagery and third-party embeds
// from the protected Preview; it never authorizes a request.
export function isUpperCrustPreviewPresentation() {
  return upperCrustPreviewPresentation(process.env);
}
