"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./restaurant-featured-gallery-slider.module.css";
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
  eyebrow: string;
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
  eyebrow,
  restaurantId,
  slides,
  title,
}: RestaurantFeaturedGallerySliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      reducedMotionRef.current = motionPreference.matches;
    };

    updateMotionPreference();
    motionPreference.addEventListener("change", updateMotionPreference);
    return () => motionPreference.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => {
      viewport.scrollLeft = viewport.clientWidth * activeIndexRef.current;
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const moveToSlide = useCallback((index: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const nextIndex = Math.max(0, Math.min(slides.length - 1, index));
    viewport.scrollTo({
      left: viewport.clientWidth * nextIndex,
      behavior: reducedMotionRef.current ? "auto" : "smooth",
    });
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="restaurant-gallery-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="restaurant-gallery-title">{title}</h2>
        </div>

        <div className={styles.desktopControls} aria-label="Gallery controls">
          <button
            type="button"
            className={styles.arrowButton}
            onClick={() => moveToSlide(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous gallery slide"
          >
            <span aria-hidden="true">&larr;</span>
          </button>
          <button
            type="button"
            className={styles.arrowButton}
            onClick={() => moveToSlide(activeIndex + 1)}
            disabled={activeIndex === slides.length - 1}
            aria-label="Next gallery slide"
          >
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport}
        tabIndex={0}
        aria-label="Featured food gallery. Use the arrow keys or swipe to change slides."
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            moveToSlide(activeIndex - 1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            moveToSlide(activeIndex + 1);
          }
        }}
        onScroll={(event) => {
          if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
          const viewport = event.currentTarget;
          scrollFrameRef.current = requestAnimationFrame(() => {
            if (viewport.clientWidth === 0) return;
            const nextIndex = Math.max(
              0,
              Math.min(slides.length - 1, Math.round(viewport.scrollLeft / viewport.clientWidth)),
            );
            activeIndexRef.current = nextIndex;
            setActiveIndex(nextIndex);
          });
        }}
      >
        <div className={styles.track}>
          {slides.map((slide, index) => {
            const isActive = index === activeIndex;
            return (
              <article
                className={styles.slide}
                key={`${slide.imageUrl}:${slide.title ?? index}`}
                aria-hidden={!isActive}
              >
                <div className={styles.media}>
                  {/* Restaurant imagery may be hosted by its configured asset provider. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.image}
                    src={slide.imageUrl}
                    alt={isActive ? slide.imageAlt : ""}
                    draggable={false}
                  />
                </div>

                <div className={styles.content}>
                  <p className={styles.slideNumber} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  {slide.title ? <h3>{slide.title}</h3> : null}
                  {slide.description ? <p className={styles.description}>{slide.description}</p> : null}
                  {slide.primaryAction || slide.secondaryAction ? (
                    <div className={styles.actions}>
                      {slide.primaryAction ? (
                        <GalleryAction
                          action={slide.primaryAction}
                          className={styles.primaryAction}
                          restaurantId={restaurantId}
                          tabIndex={isActive ? 0 : -1}
                        />
                      ) : null}
                      {slide.secondaryAction ? (
                        <GalleryAction
                          action={slide.secondaryAction}
                          className={styles.secondaryAction}
                          restaurantId={restaurantId}
                          tabIndex={isActive ? 0 : -1}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className={styles.position}>
        <p className={styles.positionLabel} aria-live="polite" aria-atomic="true">
          {activeIndex + 1} of {slides.length}
        </p>
        <div className={styles.dots} aria-label="Choose a gallery slide">
          {slides.map((slide, index) => (
            <button
              type="button"
              key={`${slide.imageUrl}:dot`}
              className={index === activeIndex ? styles.dotActive : styles.dot}
              onClick={() => moveToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
