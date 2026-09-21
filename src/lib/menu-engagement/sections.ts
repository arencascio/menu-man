import type { MenuSection } from "@/app/r/[slug]/MenuBrowser";

export type HeartCount = { item_id: string; heart_count: number };
export type FeaturedItem = { item_id: string; sort_order: number };

// Ranking is deliberately separate from menu rendering so another signal can supply this list later.
export function composeMenuSections(sections: MenuSection[], featured: FeaturedItem[], counts: HeartCount[]): MenuSection[] {
  const items = new Map(sections.flatMap((section) => section.items.map((item) => [item.id, item] as const)));
  const featuredItems = [...featured].sort((a, b) => a.sort_order - b.sort_order || a.item_id.localeCompare(b.item_id))
    .flatMap((row) => items.get(row.item_id) ? [items.get(row.item_id)!] : []);
  const favorites = [...counts]
    .filter((row) => row.heart_count >= 2 && items.has(row.item_id))
    .sort((a, b) => b.heart_count - a.heart_count || a.item_id.localeCompare(b.item_id))
    .slice(0, 8)
    .map((row) => items.get(row.item_id)!);
  return [
    ...(featuredItems.length ? [{ id: "featured", name: "Featured", description: null, sort_order: -2, items: featuredItems }] : []),
    ...(favorites.length ? [{ id: "favorites", name: "Favorites", description: null, sort_order: -1, items: favorites }] : []),
    ...sections,
  ];
}
