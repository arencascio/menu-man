"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./restaurant-footer.module.css";

export default function RestaurantFooterArtwork({ src }: { src: string }) {
  const artworkRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const footer = artworkRef.current?.closest("footer");
    if (!footer || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={artworkRef} className={`${styles.artwork} ${visible ? styles.artworkVisible : ""}`} src={src} alt="" />;
}
