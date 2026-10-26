"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { UpperCrustPhoto } from "@/lib/upper-crust/site-content";
import styles from "./upper-crust.module.css";
import RestaurantCarouselIcon from "../[slug]/RestaurantCarouselIcon";

function ApprovedAwning() {
  const x = 72, width = 456, top = 8, height = 55, valance = 18, panel = width / 12;
  const front = top + height;
  let hem = `M ${x} ${front} L ${x + width} ${front} L ${x + width} ${front + valance}`;
  for (let i = 11; i >= 0; i--) {
    hem += ` Q ${x + (i + 0.5) * panel} ${front + valance + 7} ${x + i * panel} ${front + valance}`;
  }
  hem += " Z";
  const canopy = `M ${x} ${top} L ${x + width} ${top} L ${x + width} ${front} L ${x} ${front} Z`;

  return <svg className={styles.awning} viewBox="0 0 600 128" preserveAspectRatio="none" aria-hidden="true" data-awning-variant="R3">
    <defs>
      <linearGradient id="uc-awning-depth" x2="0" y2="1"><stop stopColor="#47725a"/><stop offset=".72" stopColor="#28574c"/><stop offset="1" stopColor="#14392d"/></linearGradient>
      <linearGradient id="uc-awning-underside" x2="0" y2="1"><stop stopColor="#102c22" stopOpacity=".15"/><stop offset="1" stopColor="#081c15" stopOpacity=".6"/></linearGradient>
      <linearGradient id="uc-awning-cast" x2="0" y2="1"><stop stopColor="#13251c" stopOpacity=".78"/><stop offset="1" stopColor="#13251c" stopOpacity="0"/></linearGradient>
      <pattern id="uc-awning-stripes" width={panel * 2} height="75" patternUnits="userSpaceOnUse" x={x}>
        <rect width={panel * 2} height="75" fill="#28574c"/><rect x={panel} width={panel} height="75" fill="#3d7058"/>
        <rect width={panel * 2} height="75" fill="url(#uc-awning-depth)" opacity=".42"/>
      </pattern>
      <pattern id="uc-awning-weave" width="3" height="3" patternUnits="userSpaceOnUse">
        <path d="M0 .5h3M.5 0v3" stroke="#e8e2ba" strokeWidth=".25" opacity=".055"/>
      </pattern>
      <clipPath id="uc-awning-receiver"><rect x="12" y={front + valance - 1} width="576" height="47"/></clipPath>
      <filter id="uc-awning-soft-cast" x="-10%" y="-30%" width="120%" height="170%"><feGaussianBlur stdDeviation="2.5"/></filter>
    </defs>
    <g clipPath="url(#uc-awning-receiver)">
      <path d={hem} transform="translate(5 23)" fill="url(#uc-awning-cast)" opacity=".22" filter="url(#uc-awning-soft-cast)"/>
    </g>
    <path className={styles.awningEndCapsDesktop} d={`M ${x} ${top} L ${x - 7} ${front + valance - 2} L ${x} ${front - 3} Z M ${x + width} ${top} L ${x + width + 7} ${front + valance - 2} L ${x + width} ${front - 3} Z`} fill="#183e32"/>
    <path className={styles.awningEndCapsMobile} d={`M ${x} ${top} L ${x - 7} ${front + valance - 2} L ${x} ${front - 3} Z M ${x + width} ${top} L ${x + width + 7} ${front + valance - 2} L ${x + width} ${front - 3} Z`} fill="#183e32"/>
    <path d={canopy} fill="url(#uc-awning-stripes)"/>
    <path d={canopy} fill="url(#uc-awning-weave)"/>
    <path d={canopy} fill="url(#uc-awning-underside)" opacity=".6"/>
    <path d={`M ${x} ${top} L ${x + width} ${top}`} stroke="#729076" strokeWidth="2"/>
    <path d={hem} fill="url(#uc-awning-stripes)"/>
    <path d={hem} fill="url(#uc-awning-weave)"/>
    <path d={`M ${x} ${front + valance - 1} H ${x + width}`} stroke="#0b251b" strokeWidth="5" opacity=".6"/>
  </svg>;
}

export default function ShopWindow({ photos }: { photos: UpperCrustPhoto[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const photo = photos[active];
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);
  useEffect(() => {
    if (paused || reducedMotion || photos.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % photos.length), 8000);
    return () => window.clearInterval(timer);
  }, [paused, photos.length, reducedMotion]);
  const previous = () => setActive((current) => (current + photos.length - 1) % photos.length);
  const next = () => setActive((current) => (current + 1) % photos.length);
  return <div className={styles.shopWindow}>
    <ApprovedAwning />
    <section className={styles.windowPane} aria-label="Restaurant photos" aria-roledescription={photos.length > 1 ? "carousel" : undefined}>
      {photo ? <figure><Image key={photo.src} className={styles.windowPhoto} src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} unoptimized priority/><figcaption aria-live="polite">{photo.caption}{photo.sourceUrl ? <> · <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">Photo source ?</a></> : null}</figcaption></figure> : <p>Photo unavailable</p>}
    </section>
    {photos.length > 1 && <div data-carousel-frame="overlay" className={styles.galleryControls}>
      <button data-carousel-control="previous" type="button" aria-label="Previous food photo" onClick={previous}><RestaurantCarouselIcon name="previous"/></button>
      <div data-carousel-side="right" className={styles.galleryRightControls}>
        <button data-carousel-control="next" type="button" aria-label="Next food photo" onClick={next}><RestaurantCarouselIcon name="next"/></button>
        <button data-carousel-control="playback" type="button" disabled={reducedMotion} aria-pressed={paused || reducedMotion} aria-label={reducedMotion ? "Automatic photo advancement disabled by reduced motion preference" : paused ? "Resume automatic photo advancement" : "Pause automatic photo advancement"} onClick={() => setPaused((current) => !current)}><RestaurantCarouselIcon name={paused || reducedMotion ? "play" : "pause"}/></button>
      </div>
    </div>}
  </div>;
}
