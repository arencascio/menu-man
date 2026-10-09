"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./restaurant-footer.module.css";
import { subscribeRestaurantScroll } from "./restaurant-scroll-observer";

export default function RestaurantFooterArtwork({ src }: { src: string }) {
  const artworkRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const footer = artworkRef.current?.closest("footer");
    if (!footer || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let direction: "up" | "down" = "down";
    let intersecting = false;
    let ready = true;

    const reveal = () => {
      if (!motion.matches && intersecting && ready && direction === "down") {
        ready = false;
        setVisible(true);
      }
    };
    const onMotionChange = () => {
      if (motion.matches) {
        setVisible(true);
      } else if (!intersecting) {
        ready = true;
        setVisible(false);
      }
      reveal();
    };
    const unsubscribe = subscribeRestaurantScroll((snapshot) => {
      direction = snapshot.direction;
      reveal();
    });
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      // Arm another reveal only after leaving the footer above it on the page.
      if (!intersecting && entry.boundingClientRect.top >= window.innerHeight) {
        ready = true;
        setVisible(motion.matches);
      }
      reveal();
    });
    observer.observe(footer);
    motion.addEventListener("change", onMotionChange);
    onMotionChange();
    return () => {
      observer.disconnect();
      unsubscribe();
      motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={artworkRef} className={`${styles.artwork} ${visible ? styles.artworkVisible : ""}`} src={src} alt="" />;
}
