// Only manifest-selected menu imagery and supplied marks approved for the private
// SSO Preview are served here. Keep bytes outside public/ and use this finite map.
export const upperCrustProtectedMedia = {
  "google-g.png": { file: "provider-branding/google-g.png", contentType: "image/png" },
  "google-symbol.svg": { file: "provider-branding/google-symbol.svg", contentType: "image/svg+xml" },
  "yelp-favicon.svg": { file: "provider-branding/yelp-favicon.svg", contentType: "image/svg+xml" },
  "facebook-wordmark.svg": { file: "provider-branding/facebook-wordmark.svg", contentType: "image/svg+xml" },
  "instagram-2022.svg": { file: "provider-branding/instagram-2022.svg", contentType: "image/svg+xml" },
  "upper-crust.png": { file: "upper-crust.png", contentType: "image/png" },
  "storefront-crop.png": { file: "storefront-crop.png", contentType: "image/png" },
  "brickwall2.webp": { file: "brickwall2.webp", contentType: "image/webp" },
  "blt.jpg": { file: "awning-carousel/blt.jpg", contentType: "image/jpeg" },
  "brownie.jpg": { file: "awning-carousel/brownie.jpg", contentType: "image/jpeg" },
  "chicken salad.jpg": { file: "awning-carousel/chicken salad.jpg", contentType: "image/jpeg" },
  "cobb salad.jpg": { file: "awning-carousel/cobb salad.jpg", contentType: "image/jpeg" },
  "corned beef.jpg": { file: "awning-carousel/corned beef.jpg", contentType: "image/jpeg" },
  "hawaiian sandwich.jpg": { file: "awning-carousel/hawaiian sandwich.jpg", contentType: "image/jpeg" },
  "italian sub.jpg": { file: "awning-carousel/italian sub.jpg", contentType: "image/jpeg" },
  "pastrami and corned beef.jpg": { file: "awning-carousel/pastrami and corned beef.jpg", contentType: "image/jpeg" },
  "pastrami and roast beef.jpg": { file: "awning-carousel/pastrami and roast beef.jpg", contentType: "image/jpeg" },
  "pastrami on sourdough with potato salad.jpg": { file: "awning-carousel/pastrami on sourdough with potato salad.jpg", contentType: "image/jpeg" },
  "pastrami.jpg": { file: "awning-carousel/pastrami.jpg", contentType: "image/jpeg" },
  "tuna on wheat with clam chowder.jpg": { file: "awning-carousel/tuna on wheat with clam chowder.jpg", contentType: "image/jpeg" },
  "turkey and ham on a crossaint with poblano soup.jpg": { file: "awning-carousel/turkey and ham on a crossaint with poblano soup.jpg", contentType: "image/jpeg" },
  "Veggie sandwich and tomato florentine soup.jpg": { file: "awning-carousel/Veggie sandwich and tomato florentine soup.jpg", contentType: "image/jpeg" },
  "veggie sandwich with turkey.jpg": { file: "awning-carousel/veggie sandwich with turkey.jpg", contentType: "image/jpeg" },
  "veggie sandwich.jpg": { file: "awning-carousel/veggie sandwich.jpg", contentType: "image/jpeg" },
  "front.jpg": { file: "reference-media/front.jpg", contentType: "image/jpeg" },
  "front-door.jpg": { file: "reference-media/front-door.jpg", contentType: "image/jpeg" },
  "hanging-sign.jpg": { file: "reference-media/hanging-sign.jpg", contentType: "image/jpeg" },
  "patio.jpg": { file: "reference-media/patio.jpg", contentType: "image/jpeg" },
  "dining.jpg": { file: "reference-media/dining.jpg", contentType: "image/jpeg" },
  "takeaway.jpg": { file: "reference-media/takeaway.jpg", contentType: "image/jpeg" },
  "desserts.jpg": { file: "reference-media/desserts.jpg", contentType: "image/jpeg" },
  "menu-bbq-beef.jpg": { file: "menu-items/bbq-beef.jpg", contentType: "image/jpeg" },
  "menu-blt.jpg": { file: "menu-items/blt.jpg", contentType: "image/jpeg" },
  "menu-dinner-salad.jpg": { file: "menu-items/dinner-salad.jpg", contentType: "image/jpeg" },
  "menu-french-dip.jpg": { file: "menu-items/french-dip.jpg", contentType: "image/jpeg" },
  "menu-grinder-for-one.png": { file: "menu-items/grinder-for-one.png", contentType: "image/png" },
  "menu-grinder-for-two.png": { file: "menu-items/grinder-for-two.png", contentType: "image/png" },
  "menu-half-custom-sandwich.jpg": { file: "menu-items/half-custom-sandwich.jpg", contentType: "image/jpeg" },
  "menu-italian-sub-for-one.jpg": { file: "menu-items/italian-sub-for-one.jpg", contentType: "image/jpeg" },
} as const;

export type UpperCrustProtectedMediaKey = keyof typeof upperCrustProtectedMedia;

export function getUpperCrustProtectedMedia(asset: string) {
  return Object.hasOwn(upperCrustProtectedMedia, asset)
    ? upperCrustProtectedMedia[asset as UpperCrustProtectedMediaKey]
    : undefined;
}

export function isUpperCrustProtectedMediaPath(pathname: string) {
  const prefix = "/r/upper-crust/media/";
  if (!pathname.startsWith(prefix) || pathname.includes("\\")) return false;

  let asset = pathname.slice(prefix.length);
  for (let depth = 0; depth < 3; depth++) {
    try {
      const decoded = decodeURIComponent(asset);
      if (decoded === asset) break;
      asset = decoded;
    } catch { return false; }
  }

  if (!asset || asset.includes("/") || asset.includes("\\") || asset === "." || asset === "..") return false;
  return getUpperCrustProtectedMedia(asset) !== undefined;
}

export function upperCrustProtectedMediaUrl(asset: string) {
  if (!getUpperCrustProtectedMedia(asset)) throw new Error(`Unapproved Upper Crust media key: ${asset}`);
  return `/r/upper-crust/media/${encodeURIComponent(asset)}`;
}
