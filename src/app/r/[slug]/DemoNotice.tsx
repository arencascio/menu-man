"use client";

import { useId, useRef, useState } from "react";
import { isDemoRestaurant } from "@/lib/demo/policy";
import styles from "./demo-notice.module.css";

export default function DemoNotice({ restaurantId }: { restaurantId: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  if (!isDemoRestaurant(restaurantId)) return null;
  const close = () => { setOpen(false); toggleRef.current?.focus({ preventScroll: true }); };
  return <aside className={styles.widget} data-open={open} aria-label="Made with Menu Man"
    onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); close(); } }}>
    <button ref={toggleRef} className={styles.toggle} type="button" aria-expanded={open} aria-controls={id}
      aria-label={open ? "Close Menu Man information" : "Made with Menu Man"} onClick={() => setOpen((value) => !value)}>
      <span className={styles.mark} aria-hidden="true">M</span>Made with Menu Man
      <span className={styles.indicator} aria-hidden="true">{open ? "×" : "+"}</span>
    </button>
    <div className={styles.reveal} inert={!open} aria-hidden={!open}>
      <div className={styles.panel} id={id} role="region" aria-label="About this website">
        <p>A restaurant website with your flavor.</p>
        <a className={styles.cta} href="https://getmenuman.com/build-my-website" target="_blank" rel="noreferrer">Get a Website Like This ↗</a>
        <a className={styles.contact} href="mailto:hello@getmenuman.com">Contact Menu Man ↗</a>
      </div>
    </div>
  </aside>;
}
