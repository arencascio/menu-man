type DeliveryProviderBrand = "doordash" | "ubereats" | "grubhub" | "postmates" | "deliveroo";

function normalizeProvider(value: string | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

export function resolveDeliveryProviderBrand(providerKey: string | undefined, displayName: string): DeliveryProviderBrand | null {
  const candidates = [normalizeProvider(providerKey), normalizeProvider(displayName)];
  if (candidates.some((value) => value === "doordash")) return "doordash";
  if (candidates.some((value) => value === "ubereats" || value === "uber")) return "ubereats";
  if (candidates.some((value) => value === "grubhub" || value === "seamless")) return "grubhub";
  if (candidates.some((value) => value === "postmates")) return "postmates";
  if (candidates.some((value) => value === "deliveroo")) return "deliveroo";
  return null;
}

export default function RestaurantDeliveryProviderIcon({
  displayName,
  fallbackClassName,
  providerKey,
}: {
  displayName: string;
  fallbackClassName: string;
  providerKey?: string;
}) {
  const brand = resolveDeliveryProviderBrand(providerKey, displayName);
  if (!brand) {
    return <span className={fallbackClassName} aria-hidden="true">{displayName.charAt(0)}</span>;
  }

  const labels: Record<DeliveryProviderBrand, string> = {
    doordash: "DoorDash",
    ubereats: "Uber Eats",
    grubhub: "Grubhub",
    postmates: "Postmates",
    deliveroo: "Deliveroo",
  };
  const label = labels[brand];
  const colors: Record<DeliveryProviderBrand, { foreground: string; background: string }> = {
    doordash: { foreground: "#ffffff", background: "#ff3008" },
    ubereats: { foreground: "#06c167", background: "#111111" },
    grubhub: { foreground: "#ffffff", background: "#f63440" },
    postmates: { foreground: "#111111", background: "#ffdf00" },
    deliveroo: { foreground: "#ffffff", background: "#00ccbc" },
  };
  const color = colors[brand];

  return (
    <svg aria-hidden="true" className="restaurantDeliveryProviderIcon" viewBox="0 0 112 48">
      <rect width="112" height="48" rx="10" fill={color.background} />
      {brand === "doordash" ? <path d="M13 16h22l-7 8h-15l7-8Zm14 8h22l-7 8H20l7-8Z" fill={color.foreground} /> : null}
      {brand === "deliveroo" ? <path d="M15 16 25 11l10 5v16l-10 5-10-5V16Zm6 4v8h8v-8h-8Z" fill={color.foreground} /> : null}
      <text
        x={brand === "doordash" || brand === "deliveroo" ? "48" : "12"}
        y="30"
        fill={color.foreground}
        fontFamily="Arial, sans-serif"
        fontSize={brand === "postmates" ? "14" : "15"}
        fontWeight="700"
      >
        {label}
      </text>
    </svg>
  );
}
