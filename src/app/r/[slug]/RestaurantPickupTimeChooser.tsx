"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics/client";
import type { PickupAvailability } from "@/lib/checkout/contracts";
import { pickupIntentEvent, savePickupIntent } from "@/lib/checkout/pickup-intent";
import { formatPickupDateTime } from "@/lib/checkout/pickup-presentation";
import type { PickupSelection } from "@/lib/checkout/pickup-selection";
import { groupPickupSlots, initialChooserSelection, isChooserSelectionAvailable, type PickupChooserMode } from "./pickup-time-chooser";
import styles from "./pickup-time-chooser.module.css";

async function loadAvailability(restaurantSlug: string, signal: AbortSignal): Promise<PickupAvailability> {
  const response = await fetch(`/api/restaurants/${encodeURIComponent(restaurantSlug)}/pickup-availability`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Pickup times could not be loaded. Please try again.");
  return response.json() as Promise<PickupAvailability>;
}

export default function RestaurantPickupTimeChooser({
  mode,
  onAvailabilityChange,
  onClose,
  restaurantId,
  restaurantSlug,
}: {
  mode: PickupChooserMode;
  onAvailabilityChange: (availability: PickupAvailability) => void;
  onClose: () => void;
  restaurantId: string;
  restaurantSlug: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const confirmedRef = useRef(false);
  const scrollLockRef = useRef<{
    body: Pick<CSSStyleDeclaration, "left" | "overflow" | "position" | "right" | "top" | "width">;
    documentElement: Pick<CSSStyleDeclaration, "overflow" | "overscrollBehavior">;
    scrollY: number;
  } | null>(null);
  const [availability, setAvailability] = useState<PickupAvailability | null>(null);
  const [selection, setSelection] = useState<PickupSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const lockPageScroll = useCallback(() => {
    if (scrollLockRef.current) return;
    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    scrollLockRef.current = {
      body: { left: body.style.left, overflow: body.style.overflow, position: body.style.position, right: body.style.right, top: body.style.top, width: body.style.width },
      documentElement: { overflow: documentElement.style.overflow, overscrollBehavior: documentElement.style.overscrollBehavior },
      scrollY,
    };
    documentElement.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.right = "0";
    body.style.left = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
  }, []);

  const unlockPageScroll = useCallback(() => {
    const lock = scrollLockRef.current;
    if (!lock) return;
    const { body, documentElement } = document;
    Object.assign(body.style, lock.body);
    Object.assign(documentElement.style, lock.documentElement);
    scrollLockRef.current = null;
    window.scrollTo({ top: lock.scrollY, behavior: "instant" });
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    lockPageScroll();
    if (!dialog.open) dialog.showModal();
    titleRef.current?.focus();
    return () => unlockPageScroll();
  }, [lockPageScroll, unlockPageScroll]);

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    void loadAvailability(restaurantSlug, controller.signal).then((current) => {
      setAvailability(current);
      setSelection(initialChooserSelection(mode, current));
      onAvailabilityChange(current);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Pickup times could not be loaded. Please try again.");
    });
    return () => controller.abort();
  }, [mode, onAvailabilityChange, restaurantSlug]);

  const close = () => dialogRef.current?.close();
  const groups = availability ? groupPickupSlots(availability) : [];
  const hasTimes = Boolean((mode === "order" && availability?.asap.available) || groups.some((group) => group.slots.length > 0));
  const canContinue = availability ? isChooserSelectionAvailable(mode, availability, selection) : false;

  async function continuePickup() {
    if (!availability || !selection || !canContinue || checking) return;
    setChecking(true);
    setError(null);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const current = await loadAvailability(restaurantSlug, controller.signal);
      setAvailability(current);
      onAvailabilityChange(current);
      if (!isChooserSelectionAvailable(mode, current, selection)) {
        setSelection(null);
        setError("That pickup time is no longer available. Please choose a current time.");
        return;
      }
      try {
        savePickupIntent(window.sessionStorage, restaurantId, selection);
      } catch {
        setError("Your pickup time could not be saved. Please try again.");
        return;
      }
      confirmedRef.current = true;
      close();
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Pickup times could not be loaded. Please try again.");
    } finally {
      if (!controller.signal.aborted && dialogRef.current?.open) setChecking(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="pickup-time-chooser-title"
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      onClose={() => {
        requestRef.current?.abort();
        unlockPageScroll();
        onClose();
        if (confirmedRef.current) {
          trackEvent({ name: "pickup_clicked", restaurantId });
          window.dispatchEvent(new CustomEvent(pickupIntentEvent, { detail: restaurantId }));
        }
      }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Pickup</p>
            <h2 id="pickup-time-chooser-title" ref={titleRef} tabIndex={-1}>When do you want to pick this up?</h2>
          </div>
          <button className={styles.close} type="button" aria-label="Close pickup time chooser" onClick={close}>&times;</button>
        </header>

        <div className={styles.times}>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {!availability && !error && <p className={styles.message} role="status">Loading current pickup times…</p>}
          {availability && !hasTimes && <p className={styles.message}>No pickup times are currently available.</p>}
          {availability && hasTimes && <fieldset className={styles.choices} disabled={checking}>
            <legend className={styles.visuallyHidden}>Choose a pickup time</legend>
            {mode === "order" && availability.asap.available && (
              <label className={`${styles.choice} ${selection?.mode === "asap" ? styles.selected : ""}`}>
                <input type="radio" name="pickup-time-choice" checked={selection?.mode === "asap"} onChange={() => { setSelection({ mode: "asap" }); setError(null); }} />
                <span><strong>ASAP Pickup</strong><small>{availability.asap.estimatedPickupAt && availability.timezone ? `Ready around ${formatPickupDateTime(availability.asap.estimatedPickupAt, availability.timezone)}` : "As soon as available"}</small></span>
              </label>
            )}
            {groups.map((group) => <div className={styles.day} key={group.key}>
              <h3>{group.label}</h3>
              {group.slots.map((slot) => <label className={`${styles.choice} ${selection?.mode === "scheduled" && selection.pickupAt === slot.pickupAt ? styles.selected : ""}`} key={slot.pickupAt}>
                <input type="radio" name="pickup-time-choice" checked={selection?.mode === "scheduled" && selection.pickupAt === slot.pickupAt} onChange={() => { setSelection({ mode: "scheduled", pickupAt: slot.pickupAt }); setError(null); }} />
                <span><strong>{slot.label}</strong></span>
              </label>)}
            </div>)}
          </fieldset>}
        </div>

        <footer className={styles.footer}>
          {availability?.timezone && <small>Times shown in {availability.timezone}.</small>}
          <button className={styles.continue} type="button" disabled={!canContinue || checking} onClick={() => void continuePickup()}>{checking ? "Checking…" : "Continue"}</button>
        </footer>
      </div>
    </dialog>
  );
}
