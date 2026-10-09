"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import styles from "./restaurant-featured-gallery-slider.module.css";
import { RestaurantDeliveryTrigger } from "./RestaurantDeliveryChooser";
import TrackedRestaurantLink from "./TrackedRestaurantLink";

type GalleryActionTrackingEvent = "delivery_clicked" | "pickup_clicked";

export type RestaurantFeaturedGalleryAction = {
  href: string;
  label: string;
  external?: boolean;
  trackingEvent?: GalleryActionTrackingEvent;
};

export type RestaurantFeaturedGallerySlide = {
  imageUrl: string;
  imageAlt: string;
  title?: string;
  description?: string;
  primaryAction?: RestaurantFeaturedGalleryAction;
  secondaryAction?: RestaurantFeaturedGalleryAction;
};

type RestaurantFeaturedGallerySliderProps = {
  eyebrow?: string;
  restaurantId: string;
  slides: readonly RestaurantFeaturedGallerySlide[];
  title: string;
  showHeading?: boolean;
};

function GalleryAction({
  action,
  className,
  restaurantId,
  tabIndex,
}: {
  action: RestaurantFeaturedGalleryAction;
  className: string;
  restaurantId: string;
  tabIndex: number;
}) {
  const externalProps = action.external
    ? { target: "_blank" as const, rel: "noreferrer" }
    : {};

  if (action.trackingEvent) {
    return (
      <TrackedRestaurantLink
        className={className}
        eventName={action.trackingEvent}
        href={action.href}
        restaurantId={restaurantId}
        tabIndex={tabIndex}
        {...externalProps}
      >
        {action.label}
      </TrackedRestaurantLink>
    );
  }

  return (
    <a className={className} href={action.href} tabIndex={tabIndex} {...externalProps}>
      {action.label}
    </a>
  );
}

export default function RestaurantFeaturedGallerySlider({
  eyebrow, restaurantId, slides, title, showHeading = true,
}: RestaurantFeaturedGallerySliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const mobileRef = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const manualTargetRef = useRef<number | null>(null);
  const restartAutoplayRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");
    const updateMotion = () => { reducedMotionRef.current = motion.matches; };
    const alignSlide = () => {
      mobileRef.current = mobile.matches;
      manualTargetRef.current = null;
      const viewport = viewportRef.current;
      const panel = viewport?.querySelectorAll<HTMLElement>("article")[activeIndexRef.current];
      if (viewport && panel) {
        viewport.scrollTo({ left: mobile.matches ? panel.offsetLeft : 0, behavior: "instant" });
      }
    };
    updateMotion();
    alignSlide();
    motion.addEventListener("change", updateMotion);
    mobile.addEventListener("change", alignSlide);
    const observer = new ResizeObserver(alignSlide);
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => {
      motion.removeEventListener("change", updateMotion);
      mobile.removeEventListener("change", alignSlide);
      observer.disconnect();
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, []);

  const moveToSlide = useCallback((index: number) => {
    if (slides.length === 0) return;
    const nextIndex = (index + slides.length) % slides.length;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    restartAutoplayRef.current?.();
    const viewport = viewportRef.current;
    const panel = viewport?.querySelectorAll<HTMLElement>("article")[nextIndex];
    if (mobileRef.current && viewport && panel) {
      manualTargetRef.current = nextIndex;
      viewport.scrollTo({ left: panel.offsetLeft, behavior: reducedMotionRef.current ? "instant" : "smooth" });
    }
  }, [slides.length]);

  useEffect(() => {
    const section = sectionRef.current;
    const viewport = viewportRef.current;
    if (!section || !viewport || slides.length < 2) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointers = new Set<number>();
    let hovering = section.matches(":hover") && window.matchMedia("(hover: hover)").matches;
    let focused = section.contains(document.activeElement);
    let scrolling = false;
    let touching = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;

    const restart = () => {
      clearTimeout(timer);
      if (hovering || focused || pointers.size || touching || scrolling || document.hidden || motion.matches) return;
      timer = setTimeout(() => moveToSlide(activeIndexRef.current + 1), 7000);
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      hovering = true;
      restart();
    };
    const leave = () => { hovering = false; restart(); };
    const focusIn = () => { focused = true; restart(); };
    const focusOut = (event: FocusEvent) => {
      focused = event.relatedTarget instanceof Node && section.contains(event.relatedTarget);
      restart();
    };
    const pointerDown = (event: PointerEvent) => {
      pointers.add(event.pointerId);
      if (event.pointerType === "touch") manualTargetRef.current = null;
      restart();
    };
    const pointerUp = (event: PointerEvent) => { pointers.delete(event.pointerId); restart(); };
    const touch = (event: TouchEvent) => { touching = event.touches.length > 0; restart(); };
    const scroll = () => {
      scrolling = true;
      restart();
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { scrolling = false; restart(); }, 180);
    };
    restartAutoplayRef.current = restart;
    section.addEventListener("pointerenter", enter);
    section.addEventListener("pointerleave", leave);
    section.addEventListener("pointerdown", pointerDown);
    section.addEventListener("touchstart", touch, { passive: true });
    section.addEventListener("focusin", focusIn);
    section.addEventListener("focusout", focusOut);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
    window.addEventListener("touchend", touch, { passive: true });
    window.addEventListener("touchcancel", touch, { passive: true });
    viewport.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("visibilitychange", restart);
    motion.addEventListener("change", restart);
    restart();

    return () => {
      clearTimeout(timer);
      clearTimeout(scrollTimer);
      restartAutoplayRef.current = null;
      section.removeEventListener("pointerenter", enter);
      section.removeEventListener("pointerleave", leave);
      section.removeEventListener("pointerdown", pointerDown);
      section.removeEventListener("touchstart", touch);
      section.removeEventListener("focusin", focusIn);
      section.removeEventListener("focusout", focusOut);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("touchend", touch);
      window.removeEventListener("touchcancel", touch);
      viewport.removeEventListener("scroll", scroll);
      document.removeEventListener("visibilitychange", restart);
      motion.removeEventListener("change", restart);
    };
  }, [moveToSlide, slides.length]);

  if (slides.length === 0) return null;

  return (
    <section ref={sectionRef} className={styles.section}
      aria-labelledby={showHeading ? "restaurant-gallery-title" : undefined}
      aria-label={showHeading ? undefined : title} data-presentation="deck"
      style={{ "--gallery-active-grow": Math.max(1, (slides.length - 1) * 2.9) } as CSSProperties}>
      <div className={styles.inner}>
        {showHeading ? <div className={styles.header}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h2 id="restaurant-gallery-title">{title}</h2>
        </div> : null}
        <div className={styles.stage}>
        <div ref={viewportRef} className={styles.viewport} tabIndex={0} role="region"
          aria-roledescription="carousel"
          aria-label="Featured food gallery. Use the arrow keys or swipe to change items."
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              moveToSlide(activeIndexRef.current + (event.key === "ArrowLeft" ? -1 : 1));
            }
          }}
          onScroll={(event) => {
            if (!mobileRef.current) return;
            if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
            const viewport = event.currentTarget;
            scrollFrameRef.current = requestAnimationFrame(() => {
              const panels = Array.from(viewport.querySelectorAll<HTMLElement>("article"));
              const target = manualTargetRef.current;
              if (target !== null && panels[target] && Math.abs(panels[target].offsetLeft - viewport.scrollLeft) > 1) return;
              manualTargetRef.current = null;
              const nextIndex = panels.reduce((nearest, panel, index) =>
                Math.abs(panel.offsetLeft - viewport.scrollLeft) <
                Math.abs(panels[nearest].offsetLeft - viewport.scrollLeft) ? index : nearest, 0);
              activeIndexRef.current = nextIndex;
              setActiveIndex(nextIndex);
            });
          }}>
          <div className={styles.track}>
            {slides.map((slide, index) => {
              const isActive = index === activeIndex;
              const itemName = slide.title ?? slide.imageAlt;
              return (
                <article className={styles.slide} key={slide.imageUrl + ':' + (slide.title ?? index)}
                  data-active={isActive} aria-label={itemName}>
                  {/* Restaurant imagery may be hosted by its configured asset provider. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.image} src={slide.imageUrl} alt={slide.imageAlt} draggable={false} />
                  <button type="button" className={styles.preview} aria-label={'Show ' + itemName}
                    aria-expanded={isActive} tabIndex={isActive ? -1 : 0}
                    onClick={() => {
                      moveToSlide(index);
                      viewportRef.current?.focus({ preventScroll: true });
                    }}>
                    <span>{itemName}</span>
                  </button>
                  <div className={styles.content} inert={!isActive} aria-hidden={!isActive}>
                    {slide.title ? <h3>{slide.title}</h3> : null}
                    {slide.description ? <p className={styles.description}>{slide.description}</p> : null}
                    <div className={styles.actions}>
                      {slide.primaryAction ? (
                        <GalleryAction action={slide.primaryAction}
                          className={styles.primaryAction} restaurantId={restaurantId} tabIndex={isActive ? 0 : -1} />
                      ) : null}
                      {slide.secondaryAction ? (
                        <GalleryAction action={slide.secondaryAction} className={styles.secondaryAction}
                          restaurantId={restaurantId} tabIndex={isActive ? 0 : -1} />
                      ) : (
                        <RestaurantDeliveryTrigger className={styles.secondaryAction}>Order delivery</RestaurantDeliveryTrigger>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
          {slides.length > 1 ? (
            <div className={styles.controls} role="group" aria-label="Gallery controls">
              <button type="button" className={styles.arrowButton}
                onClick={() => moveToSlide(activeIndexRef.current - 1)} aria-label="Previous gallery item">
                {/* Lucide ArrowLeft paths, kept local like the restaurant contact icons. */}
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 19-7-7 7-7M5 12h14" />
                </svg>
              </button>
              <button type="button" className={styles.arrowButton}
                onClick={() => moveToSlide(activeIndexRef.current + 1)} aria-label="Next gallery item">
                {/* Lucide ArrowRight paths. */}
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m-7-7 7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
        <p className={styles.announcement} aria-live="polite" aria-atomic="true">
          {slides[activeIndex]?.title ?? slides[activeIndex]?.imageAlt}
        </p>
      </div>
    </section>
  );
}
