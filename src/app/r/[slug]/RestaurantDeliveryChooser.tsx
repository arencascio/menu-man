"use client";

import {
  createContext,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RestaurantActionSurface } from "@/lib/analytics/types";
import TrackedRestaurantLink from "./TrackedRestaurantLink";
import RestaurantDeliveryProviderIcon from "./RestaurantDeliveryProviderIcon";
import styles from "./restaurant-delivery-chooser.module.css";
import { lockMenuPageScroll } from "./menu-surface-scroll";
import { containOverlayFocus } from "./overlay-focus";

export type RestaurantDeliveryOption = {
  providerId?: string;
  displayName: string;
  url: string;
  imageUrl?: string;
  providerKey?: string;
  supportingLabel?: string;
};

// Deliberately has no destination: a presentation preview cannot become a link.
export type IllustrativeDeliveryOption = Pick<RestaurantDeliveryOption, "displayName" | "providerKey" | "imageUrl">;

type DeliveryChooserContextValue = {
  open: (trigger: HTMLElement, surface: RestaurantActionSurface) => void;
};

const DeliveryChooserContext = createContext<DeliveryChooserContextValue | null>(null);

export function RestaurantDeliveryTrigger({
  children,
  className,
  beforeOpen,
  returnFocusRef,
  surface = "ordering_actions",
}: {
  children: ReactNode;
  className?: string;
  beforeOpen?: (open: () => void) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  surface?: RestaurantActionSurface;
}) {
  const chooser = useContext(DeliveryChooserContext);

  if (!chooser) return null;

  return (
    <button
      aria-haspopup="dialog"
      className={className}
      type="button"
      onClick={(event) => {
        const trigger = event.currentTarget;
        const open = () => chooser.open(returnFocusRef?.current ?? trigger, surface);
        if (beforeOpen) beforeOpen(open); else open();
      }}
    >
      {children}
    </button>
  );
}

export default function RestaurantDeliveryChooser({
  children,
  options,
  illustrativeOptions = [],
  restaurantId,
}: {
  children: ReactNode;
  options: readonly RestaurantDeliveryOption[];
  illustrativeOptions?: readonly IllustrativeDeliveryOption[];
  restaurantId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [placement, setPlacement] = useState<RestaurantActionSurface>("ordering_actions");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const scrollLockRef = useRef<(() => void) | null>(null);

  const lockPageScroll = useCallback(() => {
    if (scrollLockRef.current) return;

    scrollLockRef.current = lockMenuPageScroll();
  }, []);

  const unlockPageScroll = useCallback(() => {
    scrollLockRef.current?.();
    scrollLockRef.current = null;
  }, []);

  useEffect(() => () => unlockPageScroll(), [unlockPageScroll]);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const open = useCallback((trigger: HTMLElement, surface: RestaurantActionSurface) => {
    const dialog = dialogRef.current;
    if (!dialog || (options.length === 0 && illustrativeOptions.length === 0)) return;

    returnFocusRef.current = trigger;
    setPlacement(surface);
    lockPageScroll();
    dialog.showModal();
    closeButtonRef.current?.focus();
  }, [lockPageScroll, options.length, illustrativeOptions.length]);

  const handleDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) close();
  };

  const handleClose = () => {
    unlockPageScroll();
    returnFocusRef.current?.focus({ preventScroll: true });
    returnFocusRef.current = null;
  };

  return (
    <DeliveryChooserContext.Provider value={{ open }}>
      {children}
      {options.length > 0 || illustrativeOptions.length > 0 ? (
        <dialog
          aria-labelledby="restaurant-delivery-title"
          className={styles.dialog}
          onClick={handleDialogClick}
          onClose={handleClose}
          onKeyDown={containOverlayFocus}
          aria-describedby={illustrativeOptions.length > 0 ? "restaurant-delivery-preview-note" : undefined}
          ref={dialogRef}
        >
          <div className={styles.panel}>
            <div className={styles.header}>
              <div>
                <p className={styles.eyebrow}>{illustrativeOptions.length > 0 ? "Delivery options" : "Choose a provider"}</p>
                <h2 id="restaurant-delivery-title">Order delivery</h2>
              </div>
              <button
                aria-label="Close delivery options"
                className={styles.closeButton}
                onClick={close}
                ref={closeButtonRef}
                type="button"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <div className={styles.options}>
              {illustrativeOptions.map((option) => (
                <div className={`${styles.option} ${styles.illustrativeOption}`} key={option.displayName}>
                  <RestaurantDeliveryProviderIcon displayName={option.displayName} imageUrl={option.imageUrl} providerKey={option.providerKey} fallbackClassName={styles.optionImage} />
                  <span className={styles.optionCopy}><strong>{option.displayName}</strong></span>
                </div>
              ))}
              {options.map((option) => (
                <TrackedRestaurantLink
                  className={styles.option}
                  eventName="delivery_clicked"
                  providerId={option.providerId}
                  surface="delivery_chooser"
                  placement={placement}
                  href={option.url}
                  key={`${option.displayName}:${option.url}`}
                  rel="noreferrer"
                  restaurantId={restaurantId}
                  target="_blank"
                >
                  <RestaurantDeliveryProviderIcon
                    displayName={option.displayName}
                    fallbackClassName={styles.optionImage}
                    imageUrl={option.imageUrl}
                    providerKey={option.providerKey}
                  />
                  <span className={styles.optionCopy}>
                    <strong>{option.displayName}</strong>
                    {option.supportingLabel ? <span>{option.supportingLabel}</span> : null}
                  </span>
                  <span className={styles.optionArrow} aria-hidden="true">&rarr;</span>
                </TrackedRestaurantLink>
              ))}
            </div>
            {illustrativeOptions.length > 0 ? <p className={styles.previewNote} id="restaurant-delivery-preview-note">These delivery options are illustrative. Providers are not connected, and no delivery order can be placed here.</p> : null}
          </div>
        </dialog>
      ) : null}
    </DeliveryChooserContext.Provider>
  );
}
