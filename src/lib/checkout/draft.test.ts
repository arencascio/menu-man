import assert from "node:assert/strict";
import test from "node:test";
import {
  CHECKOUT_DRAFT_TTL_MS,
  clearCheckoutDraft,
  loadCheckoutDraft,
  saveCheckoutDraft,
} from "./draft";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } satisfies Storage;
}

const now = Date.parse("2026-09-13T18:00:00.000Z");
const restaurantId = "10000000-0000-4000-8000-000000000001";
const draft = {
  restaurantId,
  customerName: "Ada Lovelace",
  phone: "555-0100",
  email: "ada@example.com",
  pickup: { mode: "scheduled" as const, pickupAt: "2026-09-13T19:00:00.000Z" },
  tipChoice: "custom" as const,
  customTipAmount: "4.25",
  orderNotes: "Ring bell",
};

test("checkout draft restores all checkout fields within the browser session", () => {
  const sessionStorage = storage();
  saveCheckoutDraft(sessionStorage, draft, now);
  assert.deepEqual(loadCheckoutDraft(sessionStorage, restaurantId, now + 1_000), {
    ...draft,
    version: 1,
    expiresAt: new Date(now + CHECKOUT_DRAFT_TTL_MS).toISOString(),
  });
});

test("checkout drafts are restaurant scoped and expire after two hours", () => {
  const sessionStorage = storage();
  saveCheckoutDraft(sessionStorage, draft, now);
  assert.equal(loadCheckoutDraft(sessionStorage, "20000000-0000-4000-8000-000000000001", now), null);
  assert.equal(loadCheckoutDraft(sessionStorage, restaurantId, now + CHECKOUT_DRAFT_TTL_MS), null);
});

test("successful checkout completion clears only that restaurant draft", () => {
  const sessionStorage = storage();
  saveCheckoutDraft(sessionStorage, draft, now);
  clearCheckoutDraft(sessionStorage, restaurantId);
  assert.equal(loadCheckoutDraft(sessionStorage, restaurantId, now), null);
});
