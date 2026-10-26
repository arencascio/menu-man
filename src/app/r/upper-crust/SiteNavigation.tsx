"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import styles from "./upper-crust.module.css";

export const upperCrustNavigation = [
  { label: "Menu", href: "/r/upper-crust/menu" },
  { label: "About Us", href: "/r/upper-crust/about" },
  { label: "Catering", href: "/r/upper-crust/catering" },
  { label: "Delivery ↗", href: "https://www.doordash.com/store/the-upper-crust-sandwich-shoppe-riverside-86182/", external: true },
  { label: "Directions ↗", href: "https://www.google.com/maps/dir/?api=1&destination=3573+Main+St%2C+Riverside%2C+CA+92501", external: true },
  { label: "Build a Sandwich", href: "/r/upper-crust/menu?item=uc-custom", primary: true },
] as const;

export default function SiteNavigation() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return <div className={styles.navigation} onKeyDown={event => { if (event.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); } }}>
    <button ref={toggle} type="button" className={styles.menuToggle} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="upper-crust-site-nav" onClick={() => setOpen(!open)}><span aria-hidden="true">{open ? "×" : "☰"}</span></button>
    <nav id="upper-crust-site-nav" aria-label="Restaurant navigation" className={open ? styles.navigationOpen : undefined}>
      {upperCrustNavigation.map(item => <Link key={item.label} href={item.href} className={"primary" in item ? styles.navCta : undefined} {...("external" in item ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})} onClick={() => setOpen(false)}>{item.label}</Link>)}
    </nav>
  </div>;
}
