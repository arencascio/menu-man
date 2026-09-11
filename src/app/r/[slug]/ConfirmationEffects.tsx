"use client";

import { useEffect, useRef } from "react";
import {
  broadcastCheckoutEvent,
  loadActiveOrderMarker,
  removeActiveOrderMarker,
} from "@/lib/payments/browser-session";
import useRestaurantCart from "./useRestaurantCart";

export default function ConfirmationEffects({
  restaurantId,
  orderId,
  currency,
}: {
  restaurantId: string;
  orderId: string;
  currency: string;
}) {
  const cart = useRestaurantCart(restaurantId, currency);
  const handled = useRef(false);

  useEffect(() => {
    if (!cart.hydrated || handled.current) return;
    handled.current = true;
    const marker = loadActiveOrderMarker(window.localStorage, restaurantId);
    void (async () => {
      if (marker?.orderId === orderId) {
        await cart.clearIfFingerprintMatches(marker.cartFingerprint);
        removeActiveOrderMarker(window.localStorage, restaurantId);
      }
      broadcastCheckoutEvent(restaurantId, "payment_terminal");
    })();
  }, [cart, orderId, restaurantId]);

  return null;
}
