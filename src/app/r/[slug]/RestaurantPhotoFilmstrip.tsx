"use client";

import { useEffect, useRef, useState } from "react";
import { advanceFilmstrip, wrapFilmstripOffset } from "./filmstrip-motion";
import styles from "./restaurant-photo-filmstrip.module.css";

type Photo = { src: string; alt: string };
export default function RestaurantPhotoFilmstrip({ photos }: { photos: readonly Photo[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const cycle = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [copies, setCopies] = useState(3);
  const state = useRef({ offset: 0, width: 0, velocity: 0, autoWeight: 0, resumeAt: 0, reduced: false, paused: false,
    visible: true, keyboard: false, pointer: -1, x: 0, y: 0, lastX: 0, lastTime: 0, dragging: false });
  useEffect(() => { state.current.paused = paused; }, [paused]);
  useEffect(() => {
    const view = viewport.current;
    const strip = track.current;
    const group = cycle.current;
    if (!view || !strip || !group) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = () => { state.current.reduced = motion.matches; state.current.velocity = 0; };
    reduced(); motion.addEventListener("change", reduced);
    const measure = () => {
      const width = group.getBoundingClientRect().width;
      state.current.width = width;
      state.current.offset = wrapFilmstripOffset(state.current.offset, width);
      setCopies(Math.max(3, Math.ceil(view.clientWidth / Math.max(1, width)) + 2));
    };
    const size = new ResizeObserver(measure); size.observe(view); size.observe(group); measure();
    const intersection = new IntersectionObserver(([entry]) => { state.current.visible = entry.isIntersecting; });
    intersection.observe(view);
    let frame = 0; let previous = performance.now();
    const animate = (now: number) => {
      const s = state.current;
      const seconds = Math.min((now - previous) / 1000, 0.05); previous = now;
      const auto = !s.reduced && !s.paused && !s.keyboard && s.pointer < 0 && now >= s.resumeAt;
      s.autoWeight += ((auto ? 1 : 0) - s.autoWeight) * (1 - Math.exp(-seconds / 1.4));
      if (s.visible && !document.hidden && s.pointer < 0) {
        const next = advanceFilmstrip(s.offset, s.reduced ? 0 : s.velocity, seconds, s.width, s.reduced || s.paused || s.keyboard ? 0 : s.autoWeight);
        s.offset = next.offset; s.velocity = next.velocity;
      }
      strip.style.transform = `translate3d(${-s.offset}px,0,0)`;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); size.disconnect(); intersection.disconnect(); motion.removeEventListener("change", reduced); };
  }, []);
  const step = (direction: number) => {
    const s = state.current;
    s.offset = wrapFilmstripOffset(s.offset + direction * (cycle.current?.querySelector("figure")?.getBoundingClientRect().width ?? 240), s.width);
    s.velocity = 0; s.autoWeight = 0; s.resumeAt = performance.now() + 1500;
  };
  return <div className={styles.filmstrip}>
    <div ref={viewport} className={styles.viewport} tabIndex={0} role="group" data-native-scroll
      aria-label="Food photographs. Drag or use left and right arrow keys to browse."
      onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) state.current.keyboard = true; }}
      onBlur={() => { state.current.keyboard = false; state.current.resumeAt = performance.now() + 1500; }}
      onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); step(event.key === "ArrowRight" ? 1 : -1); } }}
      onPointerDown={(event) => {
        if (event.button !== 0 || state.current.pointer >= 0) return;
        const s = state.current;
        s.pointer = event.pointerId; s.x = s.lastX = event.clientX; s.y = event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
        s.lastTime = performance.now(); s.velocity = 0; s.autoWeight = 0; s.dragging = false;
      }}
      onPointerMove={(event) => {
        const s = state.current; if (s.pointer !== event.pointerId) return;
        if (!s.dragging && Math.abs(event.clientX - s.x) > 6 && Math.abs(event.clientX - s.x) > Math.abs(event.clientY - s.y)) {
          s.dragging = true; event.currentTarget.setPointerCapture(event.pointerId);
        }
        if (!s.dragging) return;
        const now = performance.now(); const delta = s.lastX - event.clientX;
        s.offset = wrapFilmstripOffset(s.offset + delta, s.width);
        s.velocity = Math.max(-1800, Math.min(1800, delta / Math.max(0.008, (now - s.lastTime) / 1000)));
        s.lastX = event.clientX; s.lastTime = now;
      }}
      onPointerUp={(event) => {
        const s = state.current; if (s.pointer !== event.pointerId) return;
        if (performance.now() - s.lastTime > 100) s.velocity = 0;
        s.pointer = -1; s.dragging = false; s.resumeAt = performance.now() + 1500;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { state.current.pointer = -1; state.current.velocity = 0; state.current.dragging = false; state.current.resumeAt = performance.now() + 1500; }}
      onLostPointerCapture={() => {
        if (state.current.pointer < 0) return;
        state.current.pointer = -1; state.current.velocity = 0; state.current.dragging = false;
        state.current.resumeAt = performance.now() + 1500;
      }}>
      <div ref={track} className={styles.track}>
        {Array.from({ length: copies }, (_, copy) => <div key={copy} ref={copy === 0 ? cycle : undefined} className={styles.cycle} aria-hidden={copy > 0 || undefined}>
          {photos.map((photo, index) => <figure className={styles.photo} key={`${photo.src}:${index}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.src} alt={copy === 0 ? photo.alt : ""} width={480} height={600} loading="lazy" draggable={false} />
            <figcaption aria-hidden="true">A little more flavor</figcaption>
          </figure>)}
        </div>)}
      </div>
    </div>
    <div className={styles.controls}>
      <span>Good food. Good company.</span>
      <button type="button" aria-label="Previous photograph" onClick={() => step(-1)}>←</button>
      <button type="button" aria-label="Next photograph" onClick={() => step(1)}>→</button>
      <button type="button" aria-pressed={paused} onClick={() => { setPaused(!paused); state.current.velocity = 0; }}>{paused ? "Resume" : "Pause"} photos</button>
    </div>
  </div>;
}
