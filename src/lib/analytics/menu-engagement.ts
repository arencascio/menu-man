import { z } from "zod";
import type { AnalyticsEvent, MenuInteractionSurface } from "./types";

type Detail = {
  item: { id: string; name: string; price_cents: number };
  section: { id: string; name: string };
  mode: "full" | "quick";
};
type Section = { id: string; name: string; items: readonly { id: string }[] };
type Origin = "card" | "direct_link" | "history" | "cart";
const synthetic = ["featured", "popular", "favorites"];
const heartResult = z.object({ itemId: z.uuid(), liked: z.boolean(), count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) });

export function menuCardSurface(sectionId: string, searching: boolean): MenuInteractionSurface {
  return synthetic.includes(sectionId) ? sectionId as MenuInteractionSurface : searching ? "menu_search" : "menu";
}

// One observer per menu instance. No URL, visitor identity, or persistent dedup keys.
export function createMenuEngagement(restaurantId: string, send: (event: AnalyticsEvent) => void) {
  type ItemEvent = Extract<AnalyticsEvent, { name: "menu_item_expanded" | "menu_item_collapsed" }>;
  let active: Omit<ItemEvent, "name"> | null = null;
  const emit = (event: AnalyticsEvent) => { try { send(event); } catch { /* Never change menu/favorite behavior. */ } };
  return {
    currentSurface: () => active?.surface,
    sync(detail: Detail | null, origin: Origin, searching: boolean, sections: readonly Section[]) {
      // A quick-to-full upgrade or placement rerender is still the same opening.
      if (detail && active?.itemId === detail.item.id) return;
      if (active) emit({ name: "menu_item_collapsed", ...active });
      active = null;
      if (!detail) return;
      const canonical = sections.find((section) => !synthetic.includes(section.id) && section.items.some((item) => item.id === detail.item.id));
      const section = origin === "card" ? detail.section : canonical ?? detail.section;
      const surface: MenuInteractionSurface = origin !== "card" ? origin
        : menuCardSurface(section.id, searching);
      active = { restaurantId, itemId: detail.item.id, itemName: detail.item.name, priceCents: detail.item.price_cents,
        sectionId: section.id, sectionName: section.name, surface, detailMode: detail.mode };
      emit({ name: "menu_item_expanded", ...active });
    },
    favoriteSucceeded(itemId: string, liked: boolean, response: unknown) {
      const parsed = heartResult.safeParse(response);
      if (parsed.success && parsed.data.itemId === itemId && parsed.data.liked === liked) {
        emit({ name: "menu_favorite_changed", restaurantId, itemId: parsed.data.itemId, liked });
      }
    },
  };
}
