type RestaurantScrollSnapshot = {
  y: number;
  direction: "up" | "down";
};

const subscribers = new Set<(snapshot: RestaurantScrollSnapshot) => void>();
let frame: number | null = null;
let previousY = 0;
let direction: RestaurantScrollSnapshot["direction"] = "down";

function observeScroll() {
  if (frame !== null) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    const y = window.scrollY;
    if (y === previousY) return;
    direction = y > previousY ? "down" : "up";
    previousY = y;
    for (const subscriber of subscribers) subscriber({ y, direction });
  });
}

// One passive page listener and one position read per frame, shared by template motion.
export function subscribeRestaurantScroll(subscriber: (snapshot: RestaurantScrollSnapshot) => void) {
  if (subscribers.size === 0) {
    previousY = window.scrollY;
    direction = "down";
    window.addEventListener("scroll", observeScroll, { passive: true });
  }
  subscribers.add(subscriber);
  subscriber({ y: window.scrollY, direction });

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      window.removeEventListener("scroll", observeScroll);
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    }
  };
}
