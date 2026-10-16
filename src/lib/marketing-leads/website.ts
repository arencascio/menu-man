export const websiteError = "Enter a website such as restaurant.com or https://restaurant.com.";

// Validate public domain syntax without requiring a particular TLD or contacting the site.
// Empty values remain valid here; the form/schema decide whether a website is required.
export function normalizeWebsite(input: string): string | null {
  const value = input.trim();
  if (!value) return "";
  if (/[\s\\\u0000-\u001f\u007f]/u.test(value) || /%(?![\da-f]{2})/i.test(value)) return null;
  const explicitProtocol = /^https?:\/\//i.test(value);
  if (!explicitProtocol && (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith("/"))) return null;
  const normalized = explicitProtocol ? value : `https://${value}`;
  if (normalized.length > 500 || /^https?:\/\/[/]/i.test(normalized)) return null;
  try {
    const url = new URL(normalized);
    if (url.username || url.password) return null;
    const labels = url.hostname.split(".");
    if (url.hostname.length > 253 || labels.length < 2) return null;
    if (!labels.every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))) return null;
    if (!/^(?:[a-z]{2,63}|xn--[a-z\d-]{2,59})$/i.test(labels[labels.length - 1])) return null;
    return normalized;
  } catch {
    return null;
  }
}
