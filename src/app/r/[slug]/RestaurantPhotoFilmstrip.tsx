"use client";

import { useEffect, useId, useRef, useState } from "react";
import { advanceFilmstrip, wrapFilmstripOffset } from "./filmstrip-motion";
import styles from "./restaurant-photo-filmstrip.module.css";
import RestaurantCarouselIcon from "./RestaurantCarouselIcon";

type Photo = { src: string; alt: string; caption?: string | null; itemName?: string; source?: { label: string; href: string }; review?: { quote: string; attribution: string } };
export default function RestaurantPhotoFilmstrip({ photos, controlsLabel = "Good food. Good company.", viewportLabel = "Food photographs. Drag or use left and right arrow keys to browse.", controlsPlacement = "bottom", enableViewer = false, svgControls = false }: { photos: readonly Photo[]; controlsLabel?: string | null; viewportLabel?: string; controlsPlacement?: "bottom" | "sides"; enableViewer?: boolean; svgControls?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const cycle = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeViewerButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const dialogWasOpen = useRef(false);
  const viewerTitle = useId();
  const viewportId = useId();
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [copies, setCopies] = useState(3);
  const viewerOpen = viewerIndex !== null;
  const effectivelyPaused = paused || viewerOpen || reducedMotion;
  const state = useRef({ offset: 0, width: 0, velocity: 0, autoWeight: 0, resumeAt: 0, reduced: false, paused: false,
    visible: true, keyboard: false, pointer: -1, x: 0, y: 0, lastX: 0, lastTime: 0, dragging: false, suppressClick: false });
  useEffect(() => { state.current.paused = paused || viewerOpen; }, [paused, viewerOpen]);
  useEffect(() => {
    const view = viewport.current;
    const strip = track.current;
    const group = cycle.current;
    if (!view || !strip || !group) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = () => { state.current.reduced = motion.matches; state.current.velocity = 0; setReducedMotion(motion.matches); };
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
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (viewerIndex !== null && !element.open) {
      element.showModal();
      dialogWasOpen.current = true;
      closeViewerButton.current?.focus();
    } else if (viewerIndex === null && element.open) {
      element.close();
      if (dialogWasOpen.current && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
      dialogWasOpen.current = false;
    }
  }, [viewerIndex]);
  const step = (direction: number) => {
    const s = state.current;
    s.offset = wrapFilmstripOffset(s.offset + direction * (cycle.current?.querySelector("figure")?.getBoundingClientRect().width ?? 240), s.width);
    s.velocity = 0; s.autoWeight = 0; s.resumeAt = performance.now() + 1500;
  };
  const openViewer = (index: number, element: HTMLElement) => {
    if (!enableViewer || viewerIndex !== null) return;
    trigger.current = element;
    state.current.velocity = 0;
    setViewerIndex(index);
  };
  const closeViewer = () => {
    setViewerIndex(null);
    state.current.resumeAt = 0;
  };
  const moveViewer = (direction: number) => {
    setViewerIndex((current) => current === null ? null : (current + direction + photos.length) % photos.length);
  };
  const pauseLabel = reducedMotion
    ? "Automatic photo movement disabled by reduced motion preference"
    : viewerOpen ? "Automatic photo movement paused while photograph is expanded" : paused ? "Resume automatic photo movement" : "Pause automatic photo movement";
  const pauseButton = <button
    className={controlsPlacement === "sides" ? `${styles.iconControl} ${effectivelyPaused ? styles.playControl : styles.pauseControl}` : undefined}
    type="button"
    disabled={reducedMotion || viewerOpen}
    aria-label={pauseLabel}
    data-carousel-control={svgControls ? "playback" : undefined}
    aria-controls={viewportId}
    aria-pressed={effectivelyPaused}
    onClick={() => { setPaused((current) => !current); state.current.velocity = 0; }}
  >{svgControls ? <RestaurantCarouselIcon name={effectivelyPaused ? "play" : "pause"}/> : controlsPlacement === "sides" ? <span aria-hidden="true" /> : reducedMotion ? "Auto-advance off" : paused ? "Resume photos" : "Pause photos"}</button>;
  const previousButton = <button data-carousel-control={svgControls ? "previous" : undefined} className={styles.sideArrow} type="button" aria-label="Previous photograph" aria-controls={viewportId} onClick={() => step(-1)}><RestaurantCarouselIcon name="previous"/></button>;
  const nextButton = <button data-carousel-control={svgControls ? "next" : undefined} className={styles.sideArrow} type="button" aria-label="Next photograph" aria-controls={viewportId} onClick={() => step(1)}><RestaurantCarouselIcon name="next"/></button>;
  const viewerPhoto = viewerIndex === null ? null : photos[viewerIndex];
  return <div className={styles.filmstrip} data-controls-placement={controlsPlacement}>
    <div data-carousel-frame={svgControls ? "standard" : undefined} className={controlsPlacement === "sides" ? styles.carouselFrame : undefined}>
    {controlsPlacement === "sides" ? <div className={styles.sideControls}>{previousButton}</div> : null}
    <div ref={viewport} id={viewportId} className={styles.viewport} tabIndex={0} role="group" data-native-scroll
      aria-label={viewportLabel}
      onFocus={(event) => { if (!enableViewer && event.currentTarget.matches(":focus-visible")) state.current.keyboard = true; }}
      onBlur={() => { state.current.keyboard = false; }}
      onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); step(event.key === "ArrowRight" ? 1 : -1); } }}
      onPointerDown={(event) => {
        if (event.target instanceof Element && event.target.closest("a,button")) return;
        if (event.button !== 0 || state.current.pointer >= 0) return;
        const s = state.current;
        s.pointer = event.pointerId; s.x = s.lastX = event.clientX; s.y = event.clientY;
        s.lastTime = performance.now(); s.velocity = 0; s.autoWeight = 0; s.dragging = false; s.suppressClick = false;
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
        if (s.dragging) s.suppressClick = true;
        s.pointer = -1; s.dragging = false; s.resumeAt = performance.now() + 1500;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { state.current.pointer = -1; state.current.velocity = 0; state.current.dragging = false; state.current.resumeAt = performance.now() + 1500; }}
      onLostPointerCapture={(event) => {
        if (event.target !== event.currentTarget) return;
        if (state.current.pointer < 0) return;
        state.current.pointer = -1; state.current.velocity = 0; state.current.dragging = false;
        state.current.resumeAt = performance.now() + 1500;
      }}>
      <div ref={track} className={styles.track}>
        {Array.from({ length: copies }, (_, copy) => <div key={copy} ref={copy === 0 ? cycle : undefined} className={styles.cycle} aria-hidden={copy > 0 || undefined}>
          {photos.map((photo, index) => <figure className={`${styles.photo} ${photo.review || photo.source ? styles.richPhoto : ""}`} key={`${photo.src}:${index}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={enableViewer ? styles.viewerTrigger : undefined}
              src={photo.src}
              alt={copy === 0 ? photo.alt : ""}
              width={480}
              height={600}
              loading="lazy"
              draggable={false}
              role={enableViewer && copy === 0 ? "button" : undefined}
              tabIndex={enableViewer ? (copy === 0 ? 0 : -1) : undefined}
              aria-haspopup={enableViewer && copy === 0 ? "dialog" : undefined}
              aria-label={enableViewer && copy === 0 ? `Expand photograph: ${photo.alt}` : undefined}
              onClick={enableViewer ? (event) => {
                if (state.current.suppressClick) { state.current.suppressClick = false; return; }
                openViewer(index, copy === 0 ? event.currentTarget : viewport.current!);
              } : undefined}
              onKeyDown={enableViewer && copy === 0 ? (event) => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openViewer(index, event.currentTarget); }
              } : undefined}
            />
            {photo.caption !== null && <figcaption aria-hidden="true">{photo.caption ?? "A little more flavor"}</figcaption>}
            {(photo.review || photo.source) && <div className={styles.photoDetails}>
              {photo.itemName && <span className={styles.itemName}>{photo.itemName}</span>}
              {photo.review && <><blockquote>“{photo.review.quote}”</blockquote><p>{photo.review.attribution}</p></>}
              {photo.source && <a href={photo.source.href} tabIndex={copy === 0 ? 0 : -1} target="_blank" rel="noopener noreferrer nofollow">{photo.source.label} ↗</a>}
            </div>}
          </figure>)}
        </div>)}
      </div>
    </div>
    {controlsPlacement === "sides" ? <div data-carousel-side={svgControls ? "right" : undefined} className={`${styles.sideControls} ${styles.rightControls}`}>{nextButton}{pauseButton}</div> : null}
    </div>
    <dialog
      ref={dialog}
      className={styles.viewer}
      aria-labelledby={viewerTitle}
      onCancel={(event) => { event.preventDefault(); closeViewer(); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          moveViewer(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
    >
      {viewerPhoto && viewerIndex !== null ? <>
        <div className={styles.viewerToolbar}>
          <h2 id={viewerTitle}>Photograph {viewerIndex + 1} of {photos.length}</h2>
          <button ref={closeViewerButton} type="button" onClick={closeViewer} aria-label="Close expanded photograph">×</button>
        </div>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewerPhoto.src} alt={viewerPhoto.alt} width={480} height={600} />
          <figcaption>{viewerPhoto.alt}</figcaption>
        </figure>
        <div className={styles.viewerNavigation}>
          <button type="button" onClick={() => moveViewer(-1)} aria-label="Previous photograph"><RestaurantCarouselIcon name="previous"/></button>
          <button type="button" onClick={() => moveViewer(1)} aria-label="Next photograph"><RestaurantCarouselIcon name="next"/></button>
        </div>
      </> : null}
    </dialog>
    <div className={styles.controls}>
      {controlsLabel != null && <span>{controlsLabel}</span>}
      <button type="button" aria-label="Previous photograph" onClick={() => step(-1)}><RestaurantCarouselIcon name="previous"/></button>
      <button type="button" aria-label="Next photograph" onClick={() => step(1)}><RestaurantCarouselIcon name="next"/></button>
      {pauseButton}
    </div>
  </div>;
}
