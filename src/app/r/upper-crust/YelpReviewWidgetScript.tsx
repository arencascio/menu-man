"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

const yelpWidgetScriptUrl = "https://www.yelp.com/embed/widgets.js";

export default function YelpReviewWidgetScript() {
  const [placeholdersMounted, setPlaceholdersMounted] = useState(false);
  const retryTimer = useRef<number | null>(null);

  useEffect(() => {
    const findPlaceholders = () => document.querySelector("span.yelp-review") !== null;
    const observer = new MutationObserver(() => {
      if (!findPlaceholders()) return;
      setPlaceholdersMounted(true);
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const frame = window.requestAnimationFrame(() => {
      if (!findPlaceholders()) return;
      setPlaceholdersMounted(true);
      observer.disconnect();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => () => {
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
  }, []);

  function retryIfPlaceholdersRemain() {
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    // Yelp replaces each placeholder span with its official iframe. If its
    // cached script missed a route-mounted carousel, retry once only while the
    // original spans remain. Carousel movement never touches these iframes.
    retryTimer.current = window.setTimeout(() => {
      const pending = document.querySelector("span.yelp-review");
      if (!pending || document.querySelector('script[data-yelp-widget-retry="true"]')) return;
      const script = document.createElement("script");
      script.src = yelpWidgetScriptUrl;
      script.async = true;
      script.dataset.yelpWidgetRetry = "true";
      document.head.appendChild(script);
    }, 1500);
  }

  return placeholdersMounted ? <Script
    id="yelp-review-widgets"
    src={yelpWidgetScriptUrl}
    strategy="afterInteractive"
    onReady={retryIfPlaceholdersRemain}
  /> : null;
}
