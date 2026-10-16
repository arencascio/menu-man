export type AnalyticsCartItem = {
  itemId: string;
  itemName: string;
  priceCents: number;
  quantity: number;
};

export type RestaurantPageType = "home" | "menu" | "location" | "checkout" | "payment" | "confirmation";
export type MenuInteractionSurface = "menu" | "featured" | "popular" | "favorites" | "menu_search" | "direct_link" | "history" | "cart";
export type RestaurantActionSurface = "hero" | "header" | "footer" | "restaurant_information" | "ordering_actions" | "featured_gallery" | "delivery_chooser" | "pickup_chooser";
export type PickupAction = "internal_selection" | "external_departure";
export type AnalyticsEvent = { pageType?: RestaurantPageType } & (
  | { name: "page_view"; restaurantId: string }
  | { name: "category_selected"; restaurantId: string; sectionId: string; sectionName: string }
  | { name: "menu_search"; restaurantId: string; queryLength: number; resultCount: number }
  | { name: "menu_favorite_changed"; restaurantId: string; itemId: string; liked: boolean }
  | {
      name: "menu_item_expanded" | "menu_item_collapsed";
      restaurantId: string;
      sectionId: string;
      sectionName: string;
      itemId: string;
      itemName: string;
      priceCents: number;
      surface?: MenuInteractionSurface;
      detailMode?: "full" | "quick";
    }
  | { name: "phone_clicked" | "directions_clicked"; restaurantId: string; surface?: RestaurantActionSurface }
  | { name: "delivery_clicked"; restaurantId: string; surface?: RestaurantActionSurface; placement?: RestaurantActionSurface; providerId?: string }
  | { name: "pickup_clicked"; restaurantId: string; surface?: RestaurantActionSurface; pickupAction?: PickupAction }
  | {
      name: "add_to_cart" | "remove_from_cart";
      restaurantId: string;
      itemId: string;
      itemName: string;
      priceCents: number;
      quantity: number;
      currency: string;
      surface?: MenuInteractionSurface;
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
    });

export type AnalyticsProvider = {
  track: (event: AnalyticsEvent) => void;
};

export type MarketingPage = "/" | "/services" | "/work" | "/build-my-website";
export type MarketingForm = "website_inquiry" | "website_review";
export type MarketingPlacement = "hero" | "navigation" | "section" | "footer" | "final_cta" | "form";
export type MarketingCta = "build_website" | "website_review" | "explore_product" | "services_pricing" | "site_like_this";
export type LeadFailureCategory = "validation" | "network" | "rate_limit" | "provider_failure" | "configuration" | "unconfirmed";
export type MarketingEvent =
  | { name: "$pageview" }
  | { name: "marketing_cta_clicked"; cta_id: MarketingCta; placement: MarketingPlacement; destination_type: "page" | "modal" }
  | { name: "marketing_form_opened" | "marketing_form_started" | "marketing_lead_accepted"; form_type: MarketingForm }
  | { name: "marketing_lead_failed"; form_type: MarketingForm; failure_category: LeadFailureCategory }
  | { name: "marketing_email_clicked"; placement: MarketingPlacement; form_type?: MarketingForm };
