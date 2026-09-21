"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./restaurant-shell.module.css";

export type RestaurantNavigationItem = {
  label: string;
  href: string;
  external?: boolean;
};

type RestaurantNavigationProps = {
  homeHref: string;
  items: readonly RestaurantNavigationItem[];
  logoUrl: string | null;
  name: string;
};

export default function RestaurantNavigation({
  homeHref,
  items,
  logoUrl,
  name,
}: RestaurantNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigationId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      menuButtonRef.current?.focus();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <header className={styles.siteHeader}>
      <div className={styles.navigationInner}>
        <Link className={styles.brand} href={homeHref} onClick={() => setIsOpen(false)}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.brandMark} src={logoUrl} alt="" />
          ) : (
            <span className={`${styles.brandMark} ${styles.brandPlaceholder}`} aria-hidden="true">
              {name.charAt(0)}
            </span>
          )}
          <span className={styles.brandName}>{name}</span>
        </Link>

        <button
          ref={menuButtonRef}
          className={styles.menuButton}
          type="button"
          aria-controls={navigationId}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <nav
          id={navigationId}
          className={`${styles.navigationLinks} ${isOpen ? styles.navigationLinksOpen : ""}`}
          aria-label={`${name} navigation`}
        >
          {items.map((item) => (
            item.external ? (
              <a
                key={`${item.label}:${item.href}`}
                className={styles.navigationLink}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={`${item.label}:${item.href}`}
                className={styles.navigationLink}
                href={item.href}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            )
          ))}
        </nav>
      </div>
    </header>
  );
}
