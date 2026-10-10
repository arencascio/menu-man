"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

// Wait for the element's actual CSS exit animation. No duration timers: reduced
// motion (no animation) finishes immediately, and canceled animations settle too.
export default function useExitAnimation(ref: RefObject<HTMLElement | null>, onExited: () => void) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const callbackRef = useRef(onExited);
  useLayoutEffect(() => { callbackRef.current = onExited; });
  useLayoutEffect(() => {
    if (!closing) return;
    let active = true;
    const animations = ref.current?.getAnimations() ?? [];
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (active) callbackRef.current();
    });
    return () => { active = false; };
  }, [closing, ref]);
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
  }, []);
  const reset = useCallback(() => { closingRef.current = false; setClosing(false); }, []);
  return { closing, requestClose, reset };
}
