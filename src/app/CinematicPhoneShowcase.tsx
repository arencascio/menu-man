"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PhoneReel } from "./marketing-phone-reels";
import styles from "./marketing-phone-showcase.module.css";

type ShowcaseEvent = "viewport_entered" | "reel_selected" | "reel_advanced" | "playback_interaction" | "demo_opened";
type SavingConnection = EventTarget & { saveData?: boolean };

/** Marketing System Piece. Product content belongs in the supplied reel configuration. */
export default function CinematicPhoneShowcase({ reels, demoHref }: {
  reels: readonly [PhoneReel, ...PhoneReel[]]; demoHref?: string;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [loadMedia, setLoadMedia] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [saveData, setSaveData] = useState(true);
  const [manualPlayback, setManualPlayback] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const enteredRef = useRef(new Set<string>());
  const panelId = useId();
  const reel = reels[index];
  const allowMedia = !reduceMotion && (!saveData || manualPlayback);
  const bindVideo = useCallback((node: HTMLVideoElement | null) => {
    const previous = videoRef.current;
    if (previous && previous !== node) {
      queueMicrotask(() => {
        // Strict Mode replays refs while retaining DOM. Release resources only
        // after a real detach, never by mutating a still-mounted React subtree.
        if (!previous.isConnected) {
          previous.pause();
          previous.removeAttribute("src");
          previous.querySelectorAll("source").forEach((source) => source.remove());
          previous.load();
        }
      });
    }
    videoRef.current = node;
  }, []);

  function emit(type: ShowcaseEvent, reelId = reel.id, action?: "pause" | "play") {
    rootRef.current?.dispatchEvent(new CustomEvent("menu-man:phone-showcase", {
      bubbles: true, detail: { type, reelId, ...(action ? { action } : {}) },
    }));
  }

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    const visibility = () => setDocumentVisible(!document.hidden);
    const connection = (navigator as Navigator & { connection?: SavingConnection }).connection;
    const updateSaving = () => setSaveData(Boolean(connection?.saveData));
    update(); visibility(); updateSaving();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    connection?.addEventListener("change", updateSaving);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
      connection?.removeEventListener("change", updateSaving);
    };
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    const screen = screenRef.current;
    if (!node || !screen || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setLoadMedia(true);
      if (entry.isIntersecting && !enteredRef.current.has(reel.id)) {
        enteredRef.current.add(reel.id);
        node.dispatchEvent(new CustomEvent("menu-man:phone-showcase", {
          bubbles: true, detail: { type: "viewport_entered", reelId: reel.id },
        }));
      }
    }, { threshold: 0.08 });
    observer.observe(screen);
    return () => observer.disconnect();
  }, [reel.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    if (!visible || !documentVisible || !allowMedia || !loadMedia || paused || failed === reel.id) video.pause();
    else void video.play().catch((error: unknown) => {
      // A quick reel change or pause can interrupt a pending play request.
      if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) setFailed(reel.id);
    });
    return () => { cancelled = true; video.pause(); };
  }, [visible, documentVisible, allowMedia, loadMedia, paused, failed, reel.id]);

  function select(next: number, automatic = false) {
    if (next === index) return;
    videoRef.current?.pause();
    setPlaying(null); setFailed(null); setLoadMedia(false); setIndex(next);
    if (saveData) setManualPlayback(false);
    emit(automatic ? "reel_advanced" : "reel_selected", reels[next].id);
  }

  return (
    <div className={styles.showcase} ref={rootRef} data-phone-showcase data-motion={reduceMotion ? "reduced" : "full"}>
      <div className={styles.stage} data-view={reel.id}>
        {reel.features.map((feature, i) => <span key={i} className={`${styles.callout} ${[styles.calloutMenu, styles.calloutPath, styles.calloutDetails][i]}`}><i aria-hidden="true">{["01", "02", "03"][i]}</i><span className={styles.featureFull}>{feature}</span><span className={styles.featureCompact} aria-hidden="true">{reel.compactFeatures?.[i] ?? feature}</span></span>)}
        <div className={styles.phone}>
          <div className={styles.frame}>
            <span className={styles.sideButton} aria-hidden="true" />
            <div className={styles.screen} id={panelId} ref={screenRef}>
              {/* Always present before hydration and while the next reel loads. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.poster} src={reel.poster} alt={reel.posterAlt} width={412} height={900} />
              <video key={`${reel.id}:${loadMedia && allowMedia ? "video" : "poster"}`} ref={bindVideo} className={styles.video} poster={reel.poster}
                muted playsInline loop={reels.length === 1} preload="none" aria-label={reel.description}
                hidden={!allowMedia || failed === reel.id} data-playing={playing === reel.id}
                onEnded={() => { if (visible && documentVisible && allowMedia && !paused) select((index + 1) % reels.length, true); }}
                onPlaying={() => setPlaying(reel.id)} onError={() => setFailed(reel.id)}>
                {loadMedia && allowMedia && reel.sources.map((source) => <source key={source.src} src={source.src} type={source.type} />)}
              </video>
              <span className={styles.screenGloss} aria-hidden="true" />
            </div>
          </div>
          <span className={styles.phoneShadow} aria-hidden="true" />
        </div>
      </div>
      <div className={styles.switcher} role="group" aria-label="Choose a product preview">
        {reels.map((item, next) => <button key={item.id} type="button" aria-pressed={next === index} aria-controls={panelId} onClick={() => select(next)}>{item.label}</button>)}
      </div>
      <p className={styles.caption} role="status">{failed === reel.id ? "Video unavailable. " : ""}{reel.caption}</p>
      <div className={styles.controls}>
        {!reduceMotion && <button type="button" disabled={failed === reel.id} onClick={() => {
          const play = paused || (saveData && !manualPlayback);
          setManualPlayback(true); setPaused(!play); emit("playback_interaction", reel.id, play ? "play" : "pause");
        }}>{paused || (saveData && !manualPlayback) ? "Play preview" : "Pause preview"}</button>}
        {demoHref && <a href={demoHref} onClick={() => emit("demo_opened")}>Explore the restaurant demo <span aria-hidden="true">↗</span></a>}
      </div>
    </div>
  );
}
