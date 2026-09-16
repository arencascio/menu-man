export const CUSTOM_TIP_HEADROOM_CENTS = 50_000;

export type LargeTipConfirmation = {
  tipCents: number;
  subtotalCents: number;
  cartSubtotalCents: number;
};

export function maximumCustomTipCents(subtotalCents: number) {
  return subtotalCents + CUSTOM_TIP_HEADROOM_CENTS;
}

export function requiresLargeTipConfirmation(
  tipChoice: string,
  tipCents: number,
  subtotalCents: number,
) {
  return tipChoice === "custom" && tipCents > subtotalCents;
}

export function reconcileLargeTipConfirmation(
  confirmation: LargeTipConfirmation | null,
  tipChoice: string,
  tipCents: number | null,
  subtotalCents: number,
) {
  if (!confirmation || tipCents == null) return null;
  return requiresLargeTipConfirmation(tipChoice, tipCents, confirmation.subtotalCents)
    && confirmation.tipCents === tipCents
    && confirmation.cartSubtotalCents === subtotalCents
    ? confirmation
    : null;
}

export function parseCustomTipCents(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(normalized)) return null;
  const [dollars = "0", cents = ""] = normalized.split(".");
  const amount = BigInt(dollars || "0") * BigInt(100) + BigInt(cents.padEnd(2, "0") || "0");
  return amount <= BigInt(2_147_483_647) ? Number(amount) : null;
}
