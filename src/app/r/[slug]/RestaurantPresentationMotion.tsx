"use client";

import { useEffect } from "react";
import { subscribeRestaurantScroll } from "./restaurant-scroll-observer";

function hasNativeWheelTarget(event: WheelEvent, root: HTMLElement) {
  for (const target of event.composedPath()) {
    if (target === root) break;
    if (!(target instanceof Element)) continue;
    if (target.matches('dialog, [role="dialog"], input, textarea, select, [contenteditable], [data-native-scroll]')) return true;
    if (!(target instanceof HTMLElement)) continue;
    if (target.scrollHeight <= target.clientHeight + 1 && target.scrollWidth <= target.clientWidth + 1) continue;
    const style = getComputedStyle(target);
    if (/auto|scroll|overlay/.test(`${style.overflowX} ${style.overflowY}`)) return true;
  }
  return false;
}

export default function RestaurantPresentationMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-restaurant-presentation]");
    if (!root) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)");
    let frame: number | null = null;
    let targetY = window.scrollY;
    let lastWrittenY = window.scrollY;
    let lastTime = 0;
    let startedAt = 0;

    const cancel = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      targetY = window.scrollY;
    };
    const animate = (time: number) => {
      const elapsed = Math.min(48, Math.max(1, time - lastTime));
      lastTime = time;
      const currentY = window.scrollY;
      const remaining = targetY - currentY;
      // Brief acceleration, followed by a time-based ease-out; wheel distance stays native.
      const ramp = Math.min(1, (time - startedAt) / 70);
      const step = remaining * (1 - Math.exp(-elapsed / 60)) * ramp;
      const nextY = Math.abs(remaining) < 2.5 ? targetY : currentY + step;
      window.scrollTo({ top: nextY, behavior: "instant" });
      lastWrittenY = window.scrollY;
      if (Math.abs(targetY - lastWrittenY) < .75) {
        frame = null;
      } else {
        frame = requestAnimationFrame(animate);
      }
    };
    const wheel = (event: WheelEvent) => {
      if (motion.matches || !desktop.matches || document.hidden || event.defaultPrevented || !event.cancelable ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY) || document.querySelector('dialog[open], [aria-modal="true"]') ||
        document.body.style.position === "fixed" || hasNativeWheelTarget(event, root)) {
        cancel();
        return;
      }

      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      const base = frame === null || Math.sign(delta) !== Math.sign(targetY - window.scrollY) ? window.scrollY : targetY;
      targetY = Math.max(0, Math.min(maxY, base + delta));
      if (frame === null && Math.abs(targetY - window.scrollY) < .75) return;

      event.preventDefault();
      if (frame === null) {
        startedAt = lastTime = performance.now();
        frame = requestAnimationFrame(animate);
      }
    };
    const unsubscribe = subscribeRestaurantScroll(({ y }) => {
      // Yield to native keyboard, anchor, history, scrollbar, or programmatic scrolling.
      if (frame !== null && Math.abs(y - lastWrittenY) > 2) cancel();
    });
    const key = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) cancel();
    };

    root.addEventListener("wheel", wheel, { passive: false });
    root.addEventListener("pointerdown", cancel, { passive: true });
    root.addEventListener("touchstart", cancel, { passive: true });
    root.addEventListener("click", cancel, true);
    window.addEventListener("keydown", key);
    window.addEventListener("popstate", cancel);
    window.addEventListener("hashchange", cancel);
    window.addEventListener("resize", cancel, { passive: true });
    window.addEventListener("pagehide", cancel);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    motion.addEventListener("change", cancel);
    desktop.addEventListener("change", cancel);

    return () => {
      cancel();
      unsubscribe();
      root.removeEventListener("wheel", wheel);
      root.removeEventListener("pointerdown", cancel);
      root.removeEventListener("touchstart", cancel);
      root.removeEventListener("click", cancel, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("popstate", cancel);
      window.removeEventListener("hashchange", cancel);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("pagehide", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
      motion.removeEventListener("change", cancel);
      desktop.removeEventListener("change", cancel);
    };
  }, []);

  return null;
}
