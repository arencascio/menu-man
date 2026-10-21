import { isDemoRestaurant } from "./policy";

// Approved photographs are presentation only; item identity, pricing and ordering stay intact.
const photos: Readonly<Record<number, string>> = {
  "201": "carne-asada-tacos",
  "204": "burrito",
  "205": "chicken-burrito",
  "206": "black-bean-burrito",
  "208": "loaded-nachos",
  "209": "quesadilla",
  "210": "salsas",
  "221": "breakfast-burrito",
  "224": "breakfast-quesadilla",
  "227": "chips-and-salsa",
  "228": "churros",
  "229": "churros",
  "231": "horchata",
  "232": "chilaquiles",
  "233": "loaded-taquitos",
  "234": "queso-fundido",
  "235": "sopes",
  "236": "huevos-divorciados",
  "237": "ranchero-plate",
  "238": "fish-taco",
  "239": "menudo",
  "240": "mexican-coke",
  "241": "shrimp-cocktail",
  "242": "tortillas",
  "243": "super-taco"
};
const itemPhotos = new Map(Object.entries(photos).map(([number, photo]) => [
  `20000000-0000-4000-8000-${number.padStart(12, "0")}`, `/img/super-tacos/approved/${photo}.webp`,
]));

export function withDemoMenuImages<T extends { items: { id: string; image_url: string | null }[] }>(restaurantId: string, sections: T[]): T[] {
  if (!isDemoRestaurant(restaurantId)) return sections;
  return sections.map((section) => ({ ...section, items: section.items.map((item) => {
    return { ...item, image_url: itemPhotos.get(item.id) ?? null };
  }) }));
}
