"use client";

import Link from "next/link";
import { trackRestaurantAction } from "@/lib/analytics/restaurant-actions";
import { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import { RestaurantDeliveryTrigger } from "./RestaurantDeliveryChooser";
import RestaurantNavigationIcon, { type RestaurantNavigationIconName } from "./RestaurantNavigationIcon";
import styles from "./restaurant-shell.module.css";
import useExitAnimation from "./useExitAnimation";
import { containOverlayFocus } from "./overlay-focus";
import { lockMenuPageScroll } from "./menu-surface-scroll";
import MenuIcon from "./MenuIcon";
import RestaurantBrandLockup, { type RestaurantBrandLockupPresentation } from "./RestaurantBrandLockup";
import RestaurantWordmark from "./RestaurantWordmark";

type RestaurantNavigationDestination = {
  kind?: "link";
  label: string;
  href: string;
  external?: boolean;
  icon?: RestaurantNavigationIconName;
};

type RestaurantNavigationDelivery = {
  kind: "delivery";
  label: string;
  icon?: RestaurantNavigationIconName;
};

export type RestaurantNavigationItem = RestaurantNavigationDestination | RestaurantNavigationDelivery;

type RestaurantNavigationProps = {
  variant?: "solid" | "transparent";
  shrinkOnScroll?: boolean;
  wordmarkOnly?: boolean;
  wordmarkClassName?: string;
  restaurantId: string;
  homeHref: string;
  items: readonly RestaurantNavigationItem[];
  logoUrl: string | null;
  artworkMark?: boolean;
  brandLockup?: RestaurantBrandLockupPresentation;
  name: string;
};

export default function RestaurantNavigation({
  restaurantId,
  homeHref,
  items,
  logoUrl,
  artworkMark,
  brandLockup,
  name,
  variant,
  shrinkOnScroll = false,
  wordmarkOnly = false,
  wordmarkClassName,
}: RestaurantNavigationProps) {
  const [scrolled, setScrolled] = useState(false);
  const [shrinkScrolled, setShrinkScrolled] = useState(false);
  useEffect(() => {
    if (variant !== "transparent" && !shrinkOnScroll) return;
    const update = () => {
      if (variant === "transparent") setScrolled(window.scrollY > (shrinkOnScroll ? 80 : 24));
      if (shrinkOnScroll) setShrinkScrolled(window.scrollY > 80);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [variant, shrinkOnScroll]);
  const [isOpen, setIsOpen] = useState(false);
  const navigationId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const afterCloseRef = useRef<(() => void) | null>(null);
  const unlockRef = useRef<(() => void) | null>(null);
  const { closing, requestClose, reset } = useExitAnimation(panelRef, () => {
    dialogRef.current?.close();
    unlockRef.current?.();
    unlockRef.current = null;
    setIsOpen(false);
    menuButtonRef.current?.focus({ preventScroll: true });
    const next = afterCloseRef.current;
    afterCloseRef.current = null;
    next?.();
  });
  useLayoutEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const header = menuButtonRef.current?.closest("header");
    dialog.style.setProperty("--navigation-top", (header?.getBoundingClientRect().bottom ?? 80) + "px");
    unlockRef.current = lockMenuPageScroll();
    dialog.showModal();
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
    return () => { dialog.close(); unlockRef.current?.(); unlockRef.current = null; };
  }, [isOpen]);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1100px)");
    const resize = () => { if (!query.matches) { afterCloseRef.current = null; setIsOpen(false); reset(); } };
    query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, [reset]);

  const handleAction = (item: RestaurantNavigationDestination, mobile: boolean) => {
    if (item.icon === "phone" || item.href.startsWith("tel:")) {
      trackRestaurantAction("phone_clicked", restaurantId, { surface: "header" });
    } else if (item.icon === "directions" || item.icon === "navigation") {
      trackRestaurantAction("directions_clicked", restaurantId, { surface: "header" });
    }
    if (mobile) requestClose();
  };

  const links = (mobile: boolean) => items.map((item) => (
    item.kind === "delivery" ? (
      <RestaurantDeliveryTrigger surface="header" className={styles.navigationLink} key={item.label + ":delivery"}
        returnFocusRef={mobile ? menuButtonRef : undefined}
        beforeOpen={mobile ? (open) => { if (closing) return; afterCloseRef.current = open; requestClose(); } : undefined}>
        {item.icon ? <RestaurantNavigationIcon icon={item.icon} /> : null}{item.label}
      </RestaurantDeliveryTrigger>
    ) : item.external || item.href.startsWith("tel:") ? (
      <a key={item.label + ":" + item.href} className={styles.navigationLink} href={item.href}
        target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined}
        onClick={() => handleAction(item, mobile)}>
        {item.icon ? <RestaurantNavigationIcon icon={item.icon} /> : null}{item.label}
      </a>
    ) : (
      <Link key={item.label + ":" + item.href} className={styles.navigationLink} href={item.href} onClick={() => handleAction(item, mobile)}>
        {item.icon ? <RestaurantNavigationIcon icon={item.icon} /> : null}{item.label}
      </Link>
    )
  ));

  return (
    <div className={styles.navigationSlot} data-variant={variant} data-shrink-on-scroll={shrinkOnScroll || undefined}>
      <header className={styles.siteHeader} data-restaurant-header data-variant={variant} data-scrolled={scrolled}
        data-shrink-on-scroll={shrinkOnScroll || undefined} data-shrink-scrolled={shrinkScrolled}>
        <div className={styles.navigationInner}>
          <Link className={styles.brand} href={homeHref} aria-label={`${name} home`} onClick={() => { afterCloseRef.current = null; setIsOpen(false); }}>
            {brandLockup ? <RestaurantBrandLockup presentation={brandLockup} /> : <>
              {wordmarkOnly ? null : logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={`${styles.brandMark} ${artworkMark ? styles.artworkMark : ""}`} src={logoUrl} alt="" />
              ) : (
                <span className={`${styles.brandMark} ${styles.brandPlaceholder}`} aria-hidden="true">
                  {name.charAt(0)}
                </span>
              )}
              <RestaurantWordmark name={name} fontClassName={wordmarkClassName} className={styles.brandName} />
            </>}
          </Link>

          <button
            ref={menuButtonRef}
            className={styles.menuButton}
            type="button"
            aria-controls={navigationId}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Close navigation" : "Open navigation"}
            onClick={() => { reset(); setIsOpen(true); }}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>

          <nav className={styles.navigationLinks} aria-label={name + " navigation"}>{links(false)}</nav>
          <dialog ref={dialogRef} id={navigationId} className={styles.navigationDialog} data-closing={closing} aria-label={name + " navigation"}
            onKeyDown={containOverlayFocus} onCancel={(event) => { event.preventDefault(); requestClose(); }}
            onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
            <nav ref={panelRef} className={styles.mobileNavigation} data-closing={closing} aria-label={name + " navigation"}>
              <button className={styles.navigationClose} type="button" aria-label="Close navigation" onClick={requestClose}>Close <MenuIcon name="close" size={18} /></button>
              {links(true)}
            </nav>
          </dialog>
        </div>
      </header>
    </div>
  );
}
