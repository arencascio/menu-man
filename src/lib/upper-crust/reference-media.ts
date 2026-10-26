// Owner-provided reference photographs for this LOCAL review only.
// Bytes live outside public/ and Git, behind the local-only media route.
export const upperCrustReferenceMedia = {
  "front.jpg": { source: "Owner-provided: _logo and branding/sandwich shop/upper crust vibe/front.jpg", alt: "The Upper Crust storefront with green awning and seasonal lights", width: 750, height: 1000 },
  "front-door.jpg": { source: "Owner-provided: _logo and branding/sandwich shop/upper crust vibe/front door.jpg", alt: "The Upper Crust entrance and storefront sign", width: 750, height: 1000 },
  "hanging-sign.jpg": { source: "Owner-provided: _logo and branding/sandwich shop/upper crust vibe/hanging sign.jpg", alt: "The Upper Crust hanging sign and outdoor seating", width: 750, height: 1000 },
  "patio.jpg": { source: "Owner-provided: _logo and branding/sandwich shop/upper crust vibe/o.jpg", alt: "Outdoor tables and the Upper Crust entrance", width: 750, height: 1000 },
  "dining.jpg": { source: "Owner-provided: _logo and branding/sandwich shop/upper crust vibe/curtains.jpg", alt: "Sandwiches on a table inside the restaurant", width: 1000, height: 750 },
  "takeaway.jpg": { source: "Owner-provided: _logo and branding/sandwich shop/upper crust vibe/takeaway.jpg", alt: "A sandwich and side on an outdoor table", width: 575, height: 1000 },
  "desserts.jpg": { source: "Owner-provided: _logo and branding/sandwich shop/upper crust vibe/o (3).jpg", alt: "Cookies and brownies in the display case", width: 750, height: 1000 },
} as const;

export function isUpperCrustReferenceAsset(name: string): name is keyof typeof upperCrustReferenceMedia {
  return Object.hasOwn(upperCrustReferenceMedia, name);
}

export function isUpperCrustReferencePath(pathname: string) {
  const prefix = "/r/upper-crust/reference-media/";
  return pathname.startsWith(prefix) && isUpperCrustReferenceAsset(pathname.slice(prefix.length));
}

export const upperCrustReferenceSourcePage = "Owner-provided local photo folder: _logo and branding/sandwich shop/upper crust vibe";
