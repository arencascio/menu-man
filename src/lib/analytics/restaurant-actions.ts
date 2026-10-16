import { trackEvent } from "./client";
import type { PickupAction, RestaurantActionSurface } from "./types";

export type RestaurantLinkEvent = "phone_clicked" | "directions_clicked" | "delivery_clicked" | "pickup_clicked";
export type RestaurantActionContext = {
  surface?: RestaurantActionSurface;
  placement?: RestaurantActionSurface;
  providerId?: string;
  pickupAction?: PickupAction;
};

// Link destinations and display content are deliberately not accepted here.
export function trackRestaurantAction(name: RestaurantLinkEvent, restaurantId: string, context: RestaurantActionContext = {}) {
  try {
    const base = { restaurantId, surface: context.surface };
    if (name === "delivery_clicked") trackEvent({ name, ...base, providerId: context.providerId, placement: context.placement });
    else if (name === "pickup_clicked") trackEvent({ name, ...base, pickupAction: context.pickupAction });
    else trackEvent({ name, ...base });
  } catch { /* Analytics cannot interrupt a customer action. */ }
}
