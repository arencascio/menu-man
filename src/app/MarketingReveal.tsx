"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import styles from "./marketing-reveal.module.css";

/** Progressive enhancement: server content is visible, and only offscreen
 * groups are armed after hydration. Scrolling back never re-arms a group. */
export default function MarketingReveal({ children, className = "", as = "div", variant = "general", durationMs, turnDegrees = -75 }: {
  children: ReactNode; className?: string; as?: "div" | "ol" | "span";
  variant?: "general" | "process" | "footer"; durationMs?: number; turnDegrees?: number;
}) {
  const root = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches || element.getBoundingClientRect().top < window.innerHeight * .8) {
      element.dataset.revealState = "visible";
      return;
    }
    element.dataset.revealState = "armed";
    const reveal = () => { element.dataset.revealState = "visible"; observer.disconnect(); };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) reveal();
    }, { rootMargin: `0px 0px -${Math.round(window.innerHeight * .16)}px 0px`, threshold: .12 });
    const reduce = () => { if (motion.matches) reveal(); };
    observer.observe(element);
    element.addEventListener("focusin", reveal);
    motion.addEventListener("change", reduce);
    return () => { observer.disconnect(); element.removeEventListener("focusin", reveal); motion.removeEventListener("change", reduce); };
  }, []);
  const Tag = as;
  return <Tag ref={(node: HTMLElement | null) => { root.current = node; }} className={`${styles.group} ${className}`} data-marketing-reveal data-reveal-variant={variant}
    style={{ "--reveal-duration": `${durationMs ?? (variant === "footer" ? 1500 : variant === "process" ? 800 : 850)}ms`, "--footer-turn": `${Math.max(-85, Math.min(85, turnDegrees))}deg` } as CSSProperties}>{children}</Tag>;
}
