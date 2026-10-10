export const CART_SWIPE_DISTANCE = 72;
export const CART_SWIPE_THRESHOLD = 48;
export type CartSwipeAction = "edit" | "remove";
export type CartSwipeAxis = "pending" | "horizontal" | "vertical";

export function getCartSwipeAxis(x: number, y: number): CartSwipeAxis {
  if (Math.max(Math.abs(x), Math.abs(y)) < 10) return "pending";
  return Math.abs(x) > Math.abs(y) * 1.4 ? "horizontal" : "vertical";
}

export function getCartSwipeAction(offset: number): CartSwipeAction | null {
  if (offset >= CART_SWIPE_THRESHOLD) return "edit";
  if (offset <= -CART_SWIPE_THRESHOLD) return "remove";
  return null;
}
