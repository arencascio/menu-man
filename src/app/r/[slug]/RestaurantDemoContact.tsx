"use client";

import { useId, useRef, useState } from "react";
import styles from "./restaurant-demo-contact.module.css";

/** An illustrative contact affordance. Never calls or routes to fictional details. */
export default function RestaurantDemoContact({ children, kind, className }: {
  children: React.ReactNode; kind: "phone" | "address"; className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  return <>
    <button ref={trigger} type="button" className={`${styles.trigger} ${className ?? ""}`} popoverTarget={id}
      aria-haspopup="dialog" aria-expanded={open}>{children}</button>
    <div id={id} ref={panel} popover="auto" role="dialog" aria-label={kind === "phone" ? "Calling this restaurant" : "Restaurant directions"}
      className={styles.panel} onToggle={(event) => {
        const visible = event.newState === "open";
        setOpen(visible);
        if (visible && panel.current && trigger.current) {
          const anchor = trigger.current.getBoundingClientRect();
          const box = panel.current.getBoundingClientRect();
          panel.current.style.left = `${Math.max(12, Math.min(anchor.left, window.innerWidth - box.width - 12))}px`;
          panel.current.style.top = `${Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - box.height - 12))}px`;
        }
      }}>
      <button type="button" className={styles.close} popoverTarget={id} popoverTargetAction="hide" aria-label="Close contact information">×</button>
      <strong>{kind === "phone" ? "One tap to call" : "Directions, one tap away"}</strong>
      <p>On a live restaurant site, this would {kind === "phone" ? "start a phone call." : "open directions."}</p>
      <a href="https://getmenuman.com/build-my-website" target="_blank" rel="noreferrer">Get a Site Like This ↗</a>
    </div>
  </>;
}
