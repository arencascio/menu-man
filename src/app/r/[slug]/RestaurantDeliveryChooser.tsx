"use client";

import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
} from "react";
import TrackedRestaurantLink from "./TrackedRestaurantLink";
import styles from "./restaurant-delivery-chooser.module.css";

export type RestaurantDeliveryOption = {
  displayName: string;
  url: string;
  imageUrl?: string;
  supportingLabel?: string;
};

type DeliveryChooserContextValue = {
  open: (trigger: HTMLElement) => void;
};

const DeliveryChooserContext = createContext<DeliveryChooserContextValue | null>(null);

export function RestaurantDeliveryTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const chooser = useContext(DeliveryChooserContext);

  if (!chooser) return null;

  return (
    <button
      className={className}
      type="button"
      onClick={(event) => chooser.open(event.currentTarget)}
    >
      {children}
    </button>
  );
}

export default function RestaurantDeliveryChooser({
  children,
  options,
  restaurantId,
}: {
  children: ReactNode;
  options: readonly RestaurantDeliveryOption[];
  restaurantId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const open = useCallback((trigger: HTMLElement) => {
    const dialog = dialogRef.current;
    if (!dialog || options.length === 0) return;

    returnFocusRef.current = trigger;
    dialog.showModal();
    closeButtonRef.current?.focus();
  }, [options.length]);

  const handleDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) close();
  };

  const handleClose = () => {
    returnFocusRef.current?.focus();
    returnFocusRef.current = null;
  };

  return (
    <DeliveryChooserContext.Provider value={{ open }}>
      {children}
      {options.length > 0 ? (
        <dialog
          aria-labelledby="restaurant-delivery-title"
          className={styles.dialog}
          onClick={handleDialogClick}
          onClose={handleClose}
          ref={dialogRef}
        >
          <div className={styles.panel}>
            <div className={styles.header}>
              <div>
                <p className={styles.eyebrow}>Choose a provider</p>
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
              {options.map((option) => (
                <TrackedRestaurantLink
                  className={styles.option}
                  eventName="delivery_clicked"
                  href={option.url}
                  key={`${option.displayName}:${option.url}`}
                  rel="noreferrer"
                  restaurantId={restaurantId}
                  target="_blank"
                >
                  {option.imageUrl ? (
                    // Provider imagery may be hosted by the restaurant or provider.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.optionImage} src={option.imageUrl} alt="" />
                  ) : (
                    <span className={styles.optionMark} aria-hidden="true">
                      {option.displayName.charAt(0)}
                    </span>
                  )}
                  <span className={styles.optionCopy}>
                    <strong>{option.displayName}</strong>
                    {option.supportingLabel ? <span>{option.supportingLabel}</span> : null}
                  </span>
                  <span className={styles.optionArrow} aria-hidden="true">&rarr;</span>
                </TrackedRestaurantLink>
              ))}
            </div>
          </div>
        </dialog>
      ) : null}
    </DeliveryChooserContext.Provider>
  );
}
