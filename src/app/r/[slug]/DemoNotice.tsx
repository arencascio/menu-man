"use client";

import { useRef, useState } from "react";
import { isDemoRestaurant } from "@/lib/demo/policy";
import styles from "./demo-notice.module.css";

export default function DemoNotice({ restaurantId }: { restaurantId: string }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  if (!isDemoRestaurant(restaurantId)) return null;

  return (
    <aside
      className={styles.widget}
      aria-label="Made with Menu Man"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <div
        hidden={!open}
        className={styles.panel}
        id="menu-man-example-panel"
        role="region"
        aria-label="About this website"
      >
        <button className={styles.close} type="button" onClick={() => { setOpen(false); toggleRef.current?.focus(); }} aria-label="Close Menu Man information">
          <span aria-hidden="true">&times;</span>
        </button>
        <strong>Made with Menu Man</strong>
        <p>This example restaurant website was built with Menu Man.</p>
        <a className={styles.cta} href="https://getmenuman.com/build-my-website" target="_blank" rel="noreferrer">
          Get a website like this
        </a>
      </div>
      <button
        ref={toggleRef}
        className={styles.toggle}
        type="button"
        aria-expanded={open}
        aria-controls="menu-man-example-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.mark} aria-hidden="true">M</span>
        Made with Menu Man
      </button>
    </aside>
  );
}
