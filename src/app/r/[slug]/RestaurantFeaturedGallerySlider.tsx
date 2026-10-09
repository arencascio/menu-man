"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  eyebrow, restaurantId, slides, title,
}: RestaurantFeaturedGallerySliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const mobileRef = useRef(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");
    const updateMotion = () => { reducedMotionRef.current = motion.matches; };
    const alignSlide = () => {
      mobileRef.current = mobile.matches;
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
    const nextIndex = Math.max(0, Math.min(slides.length - 1, index));
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    const viewport = viewportRef.current;
    const panel = viewport?.querySelectorAll<HTMLElement>("article")[nextIndex];
    if (mobileRef.current && viewport && panel) {
      viewport.scrollTo({ left: panel.offsetLeft, behavior: reducedMotionRef.current ? "instant" : "smooth" });
    }
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="restaurant-gallery-title" data-presentation="deck">
      <div className={styles.inner}>
        <div className={styles.header}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h2 id="restaurant-gallery-title">{title}</h2>
        </div>
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
                  {isActive && slides.length > 1 ? (
                    <div className={styles.controls} aria-label="Gallery controls">
                      <button type="button" className={styles.arrowButton}
                        onClick={() => {
                          moveToSlide(activeIndexRef.current - 1);
                          viewportRef.current?.focus({ preventScroll: true });
                        }}
                        disabled={activeIndex === 0} aria-label="Previous gallery item">
                        <span aria-hidden="true">&larr;</span>
                      </button>
                      <button type="button" className={styles.arrowButton}
                        onClick={() => {
                          moveToSlide(activeIndexRef.current + 1);
                          viewportRef.current?.focus({ preventScroll: true });
                        }}
                        disabled={activeIndex === slides.length - 1} aria-label="Next gallery item">
                        <span aria-hidden="true">&rarr;</span>
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
        <p className={styles.announcement} aria-live="polite" aria-atomic="true">
          {slides[activeIndex]?.title ?? slides[activeIndex]?.imageAlt}
        </p>
      </div>
    </section>
  );
}
