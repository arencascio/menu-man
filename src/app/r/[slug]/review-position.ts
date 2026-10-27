export type ReviewPosition = {
  active: number;
  previous: number;
  direction: 1 | -1;
  phase: "rest" | "prepare" | "moving";
};

// Keep DOM nodes fixed. Recycle only the offscreen card after it has left the
// viewport; a modulo jump during a transition would cut through visible cards.
export function reviewSlot(index: number, count: number, position: ReviewPosition) {
  const origin = position.phase === "rest" ? position.active : position.previous;
  let slot = (index - origin + count) % count;
  if (position.phase !== "rest" && position.direction === -1 && slot === count - 1) slot = -1;
  if (position.phase === "moving") slot -= position.direction;
  return slot;
}
