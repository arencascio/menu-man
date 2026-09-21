"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./menu-browser.module.css";

export default function MenuCardImage({ name, url, priority }: { name: string; url: string | null; priority: boolean }) {
  const frame = useRef<HTMLSpanElement>(null);
  const [nearViewport, setNearViewport] = useState(priority);

  useEffect(() => {
    if (priority || !url || nearViewport) return;
    if (typeof IntersectionObserver === "undefined") {
      const frameId = requestAnimationFrame(() => setNearViewport(true));
      return () => cancelAnimationFrame(frameId);
    }
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "350px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [nearViewport, priority, url]);

  const shouldLoad = priority || nearViewport;
  return <span ref={frame} className={styles.image}>
    {url && shouldLoad ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "low"} decoding="async" width={400} height={400} />
    ) : <span className={styles.placeholder}>{name.charAt(0)}</span>}
  </span>;
}
