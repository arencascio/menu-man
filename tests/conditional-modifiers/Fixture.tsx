"use client";

import { useState } from "react";
import OrderItemPanel from "@/app/r/[slug]/OrderItemPanel";
import useRestaurantCart from "@/app/r/[slug]/useRestaurantCart";
import { createMenuItemDraft } from "@/app/r/[slug]/menu-card-ordering";
import type { MenuItem } from "@/app/r/[slug]/MenuBrowser";

const item: MenuItem = {
  id: "conditional-qa-dish", name: "Conditional QA dish", description: null,
  image_url: null, price_cents: 1000, is_orderable: true,
  modifierGroups: [
    { id: "qa-side", name: "Side Choice", description: null, minSelections: 1, maxSelections: 1, sortOrder: 0,
      options: ["Chips", "Carrot Sticks", "Drink"].map((name, index) => ({ id: `qa-option-${index}`, name, priceAdjustmentCents: index === 2 ? 200 : 0, sortOrder: index, isDefault: false })) },
    { id: "qa-ranch", name: "Ranch", description: null, minSelections: 0, maxSelections: 1, sortOrder: 1,
      visibleWhen: { groupId: "qa-side", optionId: "qa-option-1" },
      options: [{ id: "qa-ranch-option", name: "Add Ranch", priceAdjustmentCents: 50, sortOrder: 0, isDefault: false }] },
    { id: "qa-flavor", name: "Flavor", description: null, minSelections: 1, maxSelections: 1, sortOrder: 2,
      visibleWhen: { groupId: "qa-side", optionId: "qa-option-2" },
      options: [{ id: "qa-cola", name: "Cola", priceAdjustmentCents: 100, sortOrder: 0, isDefault: false }, { id: "qa-tea", name: "Tea", priceAdjustmentCents: 0, sortOrder: 1, isDefault: false }] },
  ],
};

/** Synthetic browser harness only. No restaurant fixture or order endpoint. */
export default function ConditionalModifierFixture() {
  const cart = useRestaurantCart("conditional-qa-tenant", "USD");
  const [draft, setDraft] = useState(() => createMenuItemDraft(item));
  const [editing, setEditing] = useState(false);
  const line = editing ? cart.lines[0] ?? null : null;
  return <main style={{ maxWidth: 640, margin: "0 auto", padding: 8 }}>
    <OrderItemPanel item={item} sectionId="qa" sectionName="QA" currency="USD"
      editingLine={line} draft={draft} onDraftChange={setDraft} inCartQuantity={0}
      onSave={(saved) => { if (line) cart.replaceLine(saved); else cart.addLine(saved); }}
      liked={false} heartCount={0} heartPending={false} onHeart={() => {}}
      saving={false} saveFeedback={null} saveError="" onSuccessComplete={() => {}} />
    <output aria-label="Cart subtotal cents">{cart.subtotalCents}</output>
    <output aria-label="Cart selections">{cart.lines.flatMap((entry) => entry.selectedModifiers.map((modifier) => modifier.modifierOptionName)).join(", ")}</output>
    <button onClick={() => { if (cart.lines[0]) { setEditing(true); setDraft(createMenuItemDraft(item, cart.lines[0])); } }}>Edit saved item</button>
    <button onClick={() => cart.setLineQuantity(cart.lines[0]?.lineId ?? "", 3)}>Set saved quantity to three</button>
  </main>;
}
