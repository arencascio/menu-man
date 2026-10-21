"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "./marketing-reveal.module.css";

/** Progressive enhancement: server content is visible, and only offscreen
 * groups are armed after hydration. Scrolling back never re-arms a group. */
export default function MarketingReveal({ children, className = "", as = "div" }: {
  children: ReactNode; className?: string; as?: "div" | "ol";
}) {
  const root = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches || element.getBoundingClientRect().top < window.innerHeight) return;
    element.dataset.revealState = "armed";
    const reveal = () => { element.dataset.revealState = "visible"; observer.disconnect(); };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) reveal();
    }, { rootMargin: "0px 0px -24px 0px", threshold: 0.08 });
    const reduce = () => { if (motion.matches) reveal(); };
    observer.observe(element);
    element.addEventListener("focusin", reveal);
    motion.addEventListener("change", reduce);
    return () => { observer.disconnect(); element.removeEventListener("focusin", reveal); motion.removeEventListener("change", reduce); };
  }, []);
  const Tag = as;
  return <Tag ref={(node: HTMLElement | null) => { root.current = node; }} className={`${styles.group} ${className}`} data-marketing-reveal>{children}</Tag>;
}
