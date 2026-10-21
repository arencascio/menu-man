"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./menu-browser.module.css";
import { getMenuImageFrameStyle, type MenuImagePresentation } from "./menu/menu-image-presentation";

export default function MenuCardImage({ name, url, priority, presentation }: { name: string; url: string | null; priority: boolean; presentation?: MenuImagePresentation }) {
  const frame = useRef<HTMLSpanElement>(null);
  const [nearViewport, setNearViewport] = useState(priority);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

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
    {url && shouldLoad && failedUrl !== url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} style={getMenuImageFrameStyle(presentation?.thumbnail)} ref={(image) => {
        // The initial request can fail before hydration attaches onError.
        if (image?.complete && image.naturalWidth === 0) setFailedUrl(url);
      }} onError={() => setFailedUrl(url)} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "low"} decoding="async" width={400} height={400} />
    ) : <span className={styles.placeholder}>{name.charAt(0)}</span>}
  </span>;
}
