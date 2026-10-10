"use client";

import { useLayoutEffect, useRef } from "react";
import { descriptionLineBudget } from "./menu-card-text";
import styles from "./menu-browser.module.css";

export default function MenuCardText({ name, price, description, orderable }: {
  name: string; price: string; description: string | null; orderable: boolean;
}) {
  const titleRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);
      const lines = Math.max(1, Math.round(title.getBoundingClientRect().height / lineHeight));
      title.parentElement?.style.setProperty("--description-lines", String(descriptionLineBudget(lines, window.innerWidth <= 760)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(title);
    return () => observer.disconnect();
  }, [name]);
  return <span className={styles.itemInfo}>
    <span ref={titleRef} className={styles.itemName}>{name}</span>
    <span className={styles.price}>{price}</span>
    {description && <span className={styles.itemDescription}>{description}</span>}
    {!orderable && <span className={styles.cardAvailability}>Not available for online ordering</span>}
  </span>;
}
