"use client";

import { useId, useRef, useState } from "react";
import styles from "./restaurant-reviews.module.css";

export type RestaurantReview = {
  quote: string;
  attribution: string;
  avatarUrl?: string;
  stars?: 1 | 2 | 3 | 4 | 5;
  source?: { label: string; href?: string };
};

export default function RestaurantReviews({ title, items, disclosure }: {
  eyebrow?: string; title: string; items: readonly RestaurantReview[]; disclosure?: string;
}) {
  const headingId = useId();
  const viewportId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");
  if (!items.length) return null;

  function move(direction: number | "start" | "end") {
    const element = viewport.current;
    if (!element) return;
    const card = element.firstElementChild as HTMLElement | null;
    const step = (card?.offsetWidth ?? element.clientWidth) + parseFloat(getComputedStyle(element).gap || "0");
    const maximum = element.scrollWidth - element.clientWidth;
    const proposed = typeof direction === "number" ? element.scrollLeft + direction * step : direction === "start" ? 0 : maximum;
    const next = proposed > maximum + 2 ? 0 : proposed < -2 ? maximum : proposed;
    element.scrollTo({ left: next, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    const review = items[Math.min(items.length - 1, Math.round(next / step))];
    setAnnouncement(`A sample testimonial from ${review.attribution}`);
  }

  return <section className={styles.section} aria-labelledby={headingId} aria-roledescription="carousel">
    <div className={styles.inner}>
      <div className={styles.heading}>
        <h2 id={headingId}>{title}</h2>
        <div className={styles.controls}>
          <button type="button" aria-label="Previous testimonial" aria-controls={viewportId} onClick={() => move(-1)}>&larr;</button>
          <button type="button" aria-label="Next testimonial" aria-controls={viewportId} onClick={() => move(1)}>&rarr;</button>
        </div>
      </div>
      <div ref={viewport} id={viewportId} className={styles.viewport} tabIndex={0} role="group" aria-label="Restaurant testimonials. Use left and right arrow keys to browse."
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          move(event.key === "Home" ? "start" : event.key === "End" ? "end" : event.key === "ArrowRight" ? 1 : -1);
        }}>
        {items.map((review, index) => <article className={styles.slide} key={`${review.attribution}:${index}`} aria-label={`Sample review by ${review.attribution}`}>
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
              {review.source ? <span className={styles.source}>{review.source.href ? <a href={review.source.href} target="_blank" rel="noreferrer">{review.source.label}</a> : review.source.label}</span> : null}
            </span></figcaption>
          </figure>
        </article>)}
      </div>
      {disclosure ? <p className={styles.disclosure}>{disclosure}</p> : null}
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">{announcement}</p>
    </div>
  </section>;
}
