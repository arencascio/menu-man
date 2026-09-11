export type AnalyticsCartItem = {
  itemId: string;
  itemName: string;
  priceCents: number;
  quantity: number;
};

export type AnalyticsEvent =
  | { name: "page_view"; restaurantId: string }
  | { name: "category_selected"; restaurantId: string; sectionId: string | null; sectionName: string }
  | { name: "menu_search"; restaurantId: string; query: string; queryLength: number; resultCount: number }
  | {
      name: "menu_item_expanded" | "menu_item_collapsed";
      restaurantId: string;
      sectionId: string;
      sectionName: string;
      itemId: string;
      itemName: string;
      priceCents: number;
    }
  | { name: "phone_clicked" | "directions_clicked" | "delivery_clicked" | "pickup_clicked"; restaurantId: string }
  | {
      name: "add_to_cart" | "remove_from_cart";
      restaurantId: string;
      itemId: string;
      itemName: string;
      priceCents: number;
      quantity: number;
      currency: string;
    }
  | {
      name: "cart_viewed" | "checkout_started";
      restaurantId: string;
      currency: string;
      valueCents: number;
      items: readonly AnalyticsCartItem[];
    }
  | {
      name: "order_created";
      restaurantId: string;
      orderId: string;
      orderNumber: string;
      currency: string;
      valueCents: number;
      taxCents: number;
      tipCents: number;
      pickupMode: "asap" | "scheduled";
      replayed: boolean;
      items: readonly AnalyticsCartItem[];
    };

export type AnalyticsProvider = {
  track: (event: AnalyticsEvent) => void;
};
