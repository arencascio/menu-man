export const MAX_CUSTOM_TIP_CENTS = 2_147_483_647;

export function parseCustomTipCents(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(normalized)) return null;
  const [dollars = "0", cents = ""] = normalized.split(".");
  const amount = BigInt(dollars || "0") * BigInt(100) + BigInt(cents.padEnd(2, "0") || "0");
  return amount <= BigInt(MAX_CUSTOM_TIP_CENTS) ? Number(amount) : null;
}
