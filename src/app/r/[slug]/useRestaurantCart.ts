"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import { trackEvent } from "@/lib/analytics/client";
import {
  calculateCartSubtotalCents,
  calculateUnitPriceCents,
  cartReducer,
  createCartState,
} from "@/lib/cart/cart";
import {
  loadRestaurantCart,
  saveRestaurantCart,
} from "@/lib/cart/storage";
import type { CartLine } from "@/lib/cart/types";

function trackLineChange(
  name: "add_to_cart" | "remove_from_cart",
  restaurantId: string,
  currency: string,
  line: CartLine,
  quantity: number,
) {
  trackEvent({
    name,
    restaurantId,
    itemId: line.menuItemId,
    itemName: line.itemName,
    priceCents: calculateUnitPriceCents(line),
    quantity,
    currency,
  });
}

export default function useRestaurantCart(restaurantId: string, currency: string) {
  const [state, dispatch] = useReducer(cartReducer, createCartState(restaurantId, currency));

  useEffect(() => {
    try {
      dispatch({ type: "hydrate", cart: loadRestaurantCart(window.localStorage, restaurantId, currency) });
    } catch {
      dispatch({
        type: "hydrate",
        cart: { version: 1, restaurantId, currency, lines: [], updatedAt: new Date().toISOString() },
      });
    }
  }, [currency, restaurantId]);

  useEffect(() => {
    if (!state.hydrated || state.restaurantId !== restaurantId) return;
    try {
      saveRestaurantCart(window.localStorage, {
        restaurantId: state.restaurantId,
        currency: state.currency,
        lines: state.lines,
      });
    } catch {
      // Storage failures must not prevent cart use for the current page load.
    }
  }, [restaurantId, state]);

  const addLine = useCallback((line: CartLine) => {
    dispatch({ type: "add", line });
    trackLineChange("add_to_cart", restaurantId, currency, line, line.quantity);
  }, [currency, restaurantId]);

  const replaceLine = useCallback((line: CartLine) => {
    const previousLine = state.lines.find((candidate) => candidate.lineId === line.lineId);
    if (previousLine) {
      trackLineChange("remove_from_cart", restaurantId, currency, previousLine, previousLine.quantity);
    }
    dispatch({ type: "replace", line });
    trackLineChange("add_to_cart", restaurantId, currency, line, line.quantity);
  }, [currency, restaurantId, state.lines]);

  const removeLine = useCallback((lineId: string) => {
    const line = state.lines.find((candidate) => candidate.lineId === lineId);
    if (!line) return;
    dispatch({ type: "remove", lineId });
    trackLineChange("remove_from_cart", restaurantId, currency, line, line.quantity);
  }, [currency, restaurantId, state.lines]);

  const setLineQuantity = useCallback((lineId: string, quantity: number) => {
    const line = state.lines.find((candidate) => candidate.lineId === lineId);
    if (!line || quantity === line.quantity) return;
    const nextQuantity = Math.min(99, Math.max(1, Math.trunc(quantity)));
    const difference = nextQuantity - line.quantity;
    dispatch({ type: "set_quantity", lineId, quantity: nextQuantity });
    trackLineChange(difference > 0 ? "add_to_cart" : "remove_from_cart", restaurantId, currency, line, Math.abs(difference));
  }, [currency, restaurantId, state.lines]);

  const clearCart = useCallback(() => {
    for (const line of state.lines) {
      trackLineChange("remove_from_cart", restaurantId, currency, line, line.quantity);
    }
    dispatch({ type: "clear" });
  }, [currency, restaurantId, state.lines]);

  const clearAfterOrderCreated = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  const trackCartViewed = useCallback(() => {
    trackEvent({
      name: "cart_viewed",
      restaurantId,
      currency,
      valueCents: calculateCartSubtotalCents(state.lines),
      items: state.lines.map((line) => ({
        itemId: line.menuItemId,
        itemName: line.itemName,
        priceCents: calculateUnitPriceCents(line),
        quantity: line.quantity,
      })),
    });
  }, [currency, restaurantId, state.lines]);

  return useMemo(() => ({
    ...state,
    subtotalCents: calculateCartSubtotalCents(state.lines),
    totalQuantity: state.lines.reduce((total, line) => total + line.quantity, 0),
    addLine,
    replaceLine,
    removeLine,
    setLineQuantity,
    clearCart,
    clearAfterOrderCreated,
    trackCartViewed,
  }), [addLine, clearAfterOrderCreated, clearCart, removeLine, replaceLine, setLineQuantity, state, trackCartViewed]);
}
