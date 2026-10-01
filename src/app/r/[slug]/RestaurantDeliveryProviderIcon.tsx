type DeliveryProviderBrand = "doordash" | "ubereats" | "grubhub" | "postmates" | "seamless" | "caviar";

const providerAssets: Record<DeliveryProviderBrand, string> = {
  doordash: "/img/icons/doordash-com-logo.png",
  grubhub: "/img/icons/grubhub-com-logo-dark.png",
  ubereats: "/img/icons/ubereats-com-logo.png",
  postmates: "/img/icons/postmates-com-logo.png",
  seamless: "/img/icons/seamless.png",
  caviar: "/img/icons/caviar.png",
};

function normalizeProvider(value: string | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

export function resolveDeliveryProviderBrand(providerKey: string | undefined, displayName: string): DeliveryProviderBrand | null {
  const candidates = [normalizeProvider(providerKey), normalizeProvider(displayName)];
  for (const brand of Object.keys(providerAssets) as DeliveryProviderBrand[]) {
    if (candidates.includes(brand)) return brand;
  }
  if (candidates.includes("uber")) return "ubereats";
  return null;
}

export default function RestaurantDeliveryProviderIcon({
  displayName,
  fallbackClassName,
  imageUrl,
  providerKey,
}: {
  displayName: string;
  fallbackClassName: string;
  imageUrl?: string;
  providerKey?: string;
}) {
  const brand = resolveDeliveryProviderBrand(providerKey, displayName);
  const src = brand ? providerAssets[brand] : imageUrl;
  if (!src) {
    return <span className={fallbackClassName} aria-hidden="true">{displayName.charAt(0)}</span>;
  }

  return (
    // Delivery provider logos are decorative; the provider name is shown beside each logo.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={fallbackClassName} src={src} alt="" />
  );
}
