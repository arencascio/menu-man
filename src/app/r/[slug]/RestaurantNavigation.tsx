"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import { RestaurantDeliveryTrigger } from "./RestaurantDeliveryChooser";
import RestaurantNavigationIcon, { type RestaurantNavigationIconName } from "./RestaurantNavigationIcon";
import styles from "./restaurant-shell.module.css";
import useExitAnimation from "./useExitAnimation";
import { containOverlayFocus } from "./overlay-focus";
import { lockMenuPageScroll } from "./menu-surface-scroll";
import MenuIcon from "./MenuIcon";
import RestaurantBrandLockup, { type RestaurantBrandLockupPresentation } from "./RestaurantBrandLockup";

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
  homeHref: string;
  items: readonly RestaurantNavigationItem[];
  logoUrl: string | null;
  artworkMark?: boolean;
  brandLockup?: RestaurantBrandLockupPresentation;
  name: string;
};

export default function RestaurantNavigation({
  homeHref,
  items,
  logoUrl,
  artworkMark,
  brandLockup,
  name,
}: RestaurantNavigationProps) {
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

  const links = (mobile: boolean) => items.map((item) => (
    item.kind === "delivery" ? (
      <RestaurantDeliveryTrigger className={styles.navigationLink} key={item.label + ":delivery"}
        returnFocusRef={mobile ? menuButtonRef : undefined}
        beforeOpen={mobile ? (open) => { if (closing) return; afterCloseRef.current = open; requestClose(); } : undefined}>
        {item.icon ? <RestaurantNavigationIcon icon={item.icon} /> : null}{item.label}
      </RestaurantDeliveryTrigger>
    ) : item.external || item.href.startsWith("tel:") ? (
      <a key={item.label + ":" + item.href} className={styles.navigationLink} href={item.href}
        target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined}
        onClick={mobile ? requestClose : undefined}>
        {item.icon ? <RestaurantNavigationIcon icon={item.icon} /> : null}{item.label}
      </a>
    ) : (
      <Link key={item.label + ":" + item.href} className={styles.navigationLink} href={item.href} onClick={mobile ? requestClose : undefined}>
        {item.icon ? <RestaurantNavigationIcon icon={item.icon} /> : null}{item.label}
      </Link>
    )
  ));

  return (
    <header className={styles.siteHeader} data-restaurant-header>
      <div className={styles.navigationInner}>
        <Link className={styles.brand} href={homeHref} aria-label={`${name} home`} onClick={() => { afterCloseRef.current = null; setIsOpen(false); }}>
          {brandLockup ? <RestaurantBrandLockup presentation={brandLockup} /> : <>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={`${styles.brandMark} ${artworkMark ? styles.artworkMark : ""}`} src={logoUrl} alt="" />
          ) : (
            <span className={`${styles.brandMark} ${styles.brandPlaceholder}`} aria-hidden="true">
              {name.charAt(0)}
            </span>
          )}
          <span className={styles.brandName}>{name}</span>
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
  );
}
