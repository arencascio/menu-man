"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./restaurant-reviews.module.css";
import RestaurantCarouselIcon from "./RestaurantCarouselIcon";
import { reviewSlot, type ReviewPosition } from "./review-position";

export type RestaurantReview = {
  quote: string;
  attribution: string;
  avatarUrl?: string;
  stars?: 1 | 2 | 3 | 4 | 5;
  source?: { label: string; href?: string; icon?: "google" };
};

export default function RestaurantReviews({ title, items, disclosure, autoAdvance = false, autoAdvanceInterval = 11000, controlsPlacement = "heading", yelpEmbeds = [], svgControls = false, sourceLinks = [] }: {
  eyebrow?: string; title: string; items: readonly RestaurantReview[]; disclosure?: string;
  autoAdvance?: boolean; autoAdvanceInterval?: number; controlsPlacement?: "heading" | "sides";
  svgControls?: boolean;
  sourceLinks?: readonly { label: string; href: string }[];
  yelpEmbeds?: readonly { reviewId: string; userId: string }[];
}) {
  const headingId = useId();
  const viewportId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // Mixed provider slides stay in their original DOM order. Only their visual
  // positions change; moving an initialized iframe in the DOM can reload it.
  const circular = yelpEmbeds.length > 0;
  const reviewLabels = Array.from({ length: Math.max(items.length, yelpEmbeds.length) }, (_, index) => [
    ...(items[index] ? [`Review excerpt from ${items[index].attribution}`] : []),
    ...(yelpEmbeds[index] ? ["Official Yelp review"] : []),
  ]).flat();
  const reviewCount = reviewLabels.length;
  const [position, setPosition] = useState<ReviewPosition>({ active: 0, previous: 0, direction: 1, phase: "rest" });
  const [visibleCount, setVisibleCount] = useState(3);
  const moving = useRef(false);
  const movementFrame = useRef<number | null>(null);
  const movementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveRef = useRef<(direction: number | "start" | "end", announce?: boolean) => void>(() => {});

  useEffect(() => {
    if (!circular || !viewport.current) return;
    const element = viewport.current;
    const measure = () => {
      if (!element.clientWidth) return;
      setVisibleCount(Number(getComputedStyle(element).getPropertyValue("--review-visible")) || 1);
      // Yelp has a native 320px minimum. Scale our host, never the provider's
      // contents or iframe attributes, to fit narrower mobile carousel slots.
      element.querySelectorAll<HTMLElement>("[data-review-provider]").forEach(host => {
        const card = host.parentElement;
        if (!card) return;
        const scale = Math.min(1, card.clientWidth / (host.offsetWidth || 320));
        host.style.transform = `scale(${scale})`;
        card.style.height = `${host.offsetHeight * scale}px`;
      });
      // Measure the original wrappers, including Yelp's asynchronously resized
      // iframes. A stable rail height prevents clipping and control movement.
      const height = Math.max(...Array.from(element.children, child => child.getBoundingClientRect().height));
      element.style.height = `${Math.ceil(height)}px`;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    Array.from(element.children).forEach(child => observer.observe(child));
    element.querySelectorAll("[data-review-provider]").forEach(host => observer.observe(host));
    measure();
    return () => observer.disconnect();
  }, [circular, reviewCount]);

  useEffect(() => () => {
    if (movementTimer.current) clearTimeout(movementTimer.current);
    if (movementFrame.current !== null) cancelAnimationFrame(movementFrame.current);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) {
        moving.current = false;
        setPosition(current => ({ ...current, phase: "rest" }));
        if (movementFrame.current !== null) cancelAnimationFrame(movementFrame.current);
        if (movementTimer.current) clearTimeout(movementTimer.current);
      }
    };
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (!autoAdvance || reducedMotion || paused || hovered || focused) return;
    const timer = window.setInterval(() => moveRef.current(1, false), autoAdvanceInterval);
    return () => window.clearInterval(timer);
  }, [autoAdvance, autoAdvanceInterval, focused, hovered, paused, reducedMotion]);

  function move(direction: number | "start" | "end", announce = true) {
    if (circular) {
      if ((moving.current && typeof direction === "number") || !reviewCount) return;
      const next = typeof direction === "number"
        ? (position.active + direction + reviewCount) % reviewCount
        : direction === "start" ? 0 : reviewCount - 1;
      const animate = !reducedMotion && typeof direction === "number";
      const step = direction === -1 ? -1 : 1;
      moving.current = animate;
      if (movementTimer.current) clearTimeout(movementTimer.current);
      if (movementFrame.current !== null) cancelAnimationFrame(movementFrame.current);
      const nextPosition: ReviewPosition = { active: next, previous: position.active, direction: step, phase: animate ? "prepare" : "rest" };
      setPosition(nextPosition);
      if (announce) setAnnouncement(`${reviewLabels[next]}. Review ${next + 1} of ${reviewCount}.`);
      if (animate) {
        // Paint the reverse entry card just outside the left edge before moving.
        // Neither this preparation nor settlement moves/recreates an iframe.
        movementFrame.current = requestAnimationFrame(() => {
          movementFrame.current = requestAnimationFrame(() => {
            setPosition({ ...nextPosition, phase: "moving" });
            movementTimer.current = setTimeout(() => {
              setPosition({ ...nextPosition, phase: "rest" });
              moving.current = false;
            }, 450);
          });
        });
      }
      return;
    }
    const element = viewport.current;
    if (!element) return;
    const card = element.firstElementChild as HTMLElement | null;
    const step = (card?.offsetWidth ?? element.clientWidth) + parseFloat(getComputedStyle(element).gap || "0");
    const maximum = element.scrollWidth - element.clientWidth;
    const proposed = typeof direction === "number" ? element.scrollLeft + direction * step : direction === "start" ? 0 : maximum;
    const next = proposed > maximum + 2 ? 0 : proposed < -2 ? maximum : proposed;
    element.scrollTo({ left: next, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    if (announce) {
      const review = items[Math.min(items.length - 1, Math.round(next / step))];
      setAnnouncement(`Review excerpt from ${review.attribution}`);
    }
  }

  useEffect(() => { moveRef.current = move; });

  if (!reviewCount) return null;

  const previousButton = <button className={controlsPlacement === "sides" ? styles.sideArrow : undefined} type="button" data-carousel-control={svgControls ? "previous" : undefined} aria-label="Previous testimonial" aria-controls={viewportId} onClick={() => { setPaused(true); move(-1); }}>{svgControls ? <RestaurantCarouselIcon name="previous"/> : "\u2190"}</button>;
  const nextButton = <button className={controlsPlacement === "sides" ? styles.sideArrow : undefined} type="button" data-carousel-control={svgControls ? "next" : undefined} aria-label="Next testimonial" aria-controls={viewportId} onClick={() => { setPaused(true); move(1); }}>{svgControls ? <RestaurantCarouselIcon name="next"/> : "\u2192"}</button>;
  const pauseButton = autoAdvance ? <button data-carousel-control={svgControls ? "playback" : undefined} className={`${styles.pause} ${controlsPlacement === "sides" ? styles.iconPause : ""}`} type="button" disabled={reducedMotion} aria-pressed={paused} aria-label={reducedMotion ? "Automatic advancement disabled by reduced motion preference" : paused ? "Resume automatic advancement" : "Pause automatic advancement"} onClick={() => setPaused((current) => !current)}>{svgControls ? <RestaurantCarouselIcon name={paused || reducedMotion ? "play" : "pause"}/> : controlsPlacement === "sides" ? <span className={paused ? styles.playGlyph : styles.pauseGlyph} aria-hidden="true" /> : reducedMotion ? "Auto-advance off" : paused ? "Resume" : "Pause"}</button> : null;
  const rightControls = controlsPlacement === "sides" ? <div data-carousel-side={svgControls ? "right" : undefined} className={styles.rightControls}>{nextButton}{pauseButton}</div> : null;
  const pauseInteraction = () => setPaused(true);

  function slideProps(index: number) {
    if (!circular) return {};
    const slot = reviewSlot(index, reviewCount, position);
    const finalSlot = (index - position.active + reviewCount) % reviewCount;
    const visible = finalSlot < visibleCount;
    return {
      style: {
        transform: `translateX(calc(${slot} * (100% + 1rem)))`,
        transition: position.phase === "moving" ? undefined : "none",
      },
      inert: !visible,
      "aria-hidden": !visible,
      "aria-roledescription": "slide",
      "data-review-index": index,
      role: "group",
    };
  }

  return <section className={styles.section} aria-labelledby={headingId} aria-roledescription="carousel">
    <div className={styles.inner}>
      <div className={styles.heading}>
        <h2 id={headingId}>{title}</h2>
        {controlsPlacement === "heading" ? <div className={styles.controls}>{previousButton}{nextButton}{pauseButton}</div> : null}
      </div>
      {sourceLinks.length ? <nav className={styles.sourceLinks} aria-label="Review sources">{sourceLinks.map(link => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer nofollow">{link.label} <span aria-hidden="true">↗</span></a>)}</nav> : null}
      <div data-carousel-frame={svgControls ? "standard" : undefined} className={controlsPlacement === "sides" ? styles.sideFrame : undefined} data-auto-advance={autoAdvance && !reducedMotion && !paused && !hovered && !focused ? "on" : "off"}>
        {controlsPlacement === "sides" ? previousButton : null}
        <div ref={viewport} id={viewportId} className={`${styles.viewport} ${circular ? styles.circularViewport : ""}`} data-active-index={circular ? position.active : undefined} data-motion-phase={circular ? position.phase : undefined} data-review-count={circular ? reviewCount : items.length} tabIndex={0} role="group" aria-label={circular ? `${reviewCount} ${items.length ? "restaurant and Yelp" : "Yelp"} reviews. Use left and right arrow keys to browse.` : "Restaurant testimonials. Use left and right arrow keys to browse."}
          onPointerDown={pauseInteraction}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            setPaused(true);
            move(event.key === "Home" ? "start" : event.key === "End" ? "end" : event.key === "ArrowRight" ? 1 : -1);
          }}>
          {Array.from({ length: Math.max(items.length, yelpEmbeds.length) }, (_, index) => {
            const review = items[index];
            const mixedIndex = Math.min(index, items.length) + Math.min(index, yelpEmbeds.length);
            const cards = review ? [<article className={styles.slide} key={`text:${index}`} {...slideProps(mixedIndex)} aria-label={circular ? `Review ${mixedIndex + 1} of ${reviewCount}. Review excerpt attributed to ${review.attribution}` : `Review excerpt attributed to ${review.attribution}`}>
          <figure>
            {review.stars != null ? <p className={styles.stars}><span role="img" aria-label={`${review.stars} out of 5 stars`}>{"\u2605".repeat(review.stars)}</span></p> : null}
            <blockquote><p>&ldquo;{review.quote}&rdquo;</p></blockquote>
            <figcaption><span className={styles.avatar} aria-hidden="true">{review.avatarUrl ? (
              // Decorative stock portraits do not identify the fictional review authors.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={review.avatarUrl} alt="" width={48} height={48} loading="lazy" ref={(image) => {
                if (image?.complete && image.naturalWidth === 0) image.hidden = true;
              }} onError={(event) => { event.currentTarget.hidden = true; }} />
            ) : review.attribution.split(" ").map((part) => part[0]).join("")}</span><span>{review.attribution}
              {review.source ? <span className={styles.source}>{review.source.icon === "google" ? <Image className={styles.sourceIcon} src="/img/icons/google-g.png" alt="Google" width={18} height={18} unoptimized /> : null}{review.source.href ? <a href={review.source.href} target="_blank" rel="noreferrer">{review.source.label}</a> : review.source.label}</span> : null}
            </span></figcaption>
          </figure>
          </article>] : [];
            if (yelpEmbeds[index]) {
              const embed = yelpEmbeds[index];
              const embedIndex = mixedIndex + (review ? 1 : 0);
              cards.push(<article className={`${styles.slide} ${styles.providerSlide}`} key={`yelp:${embed.reviewId}`} {...slideProps(embedIndex)} aria-label={`Review ${embedIndex + 1} of ${reviewCount}. Official Yelp review`}><div className={styles.providerContent} data-review-provider="yelp"><span className="yelp-review" data-review-id={embed.reviewId} data-hostname="www.yelp.com" data-business-id="the-upper-crust-sandwich-shoppe-riverside" data-user-id={embed.userId} data-review-languages="en"><a href={`https://www.yelp.com/biz/the-upper-crust-sandwich-shoppe-riverside?hrid=${embed.reviewId}`} target="_blank" rel="noreferrer">View this review on Yelp</a></span></div></article>);
            }
            return cards;
          })}
        </div>
        {rightControls}
      </div>
      {disclosure ? <p className={styles.disclosure}>{disclosure}</p> : null}
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">{announcement}</p>
    </div>
  </section>;
}
