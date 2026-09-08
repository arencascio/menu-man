export type AnalyticsEvent =
  | { name: "page_view"; restaurantId: string }
  | { name: "category_selected"; restaurantId: string; sectionId: string | null }
  | { name: "menu_search"; restaurantId: string; queryLength: number; resultCount: number }
  | { name: "menu_item_expanded" | "menu_item_collapsed"; restaurantId: string; itemId: string; sectionId: string }
  | { name: "phone_clicked" | "directions_clicked" | "delivery_clicked" | "pickup_clicked"; restaurantId: string };

export type AnalyticsProvider = {
  track: (event: AnalyticsEvent) => void;
};
