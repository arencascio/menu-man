"use client";

import Script from "next/script";
import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { analyticsEligibility } from "@/lib/analytics/eligibility";
import { marketingPages } from "@/lib/analytics/marketing";

export default function AnalyticsScripts() {
  const pathname = usePathname();
  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const [allowed, setAllowed] = useState(false);
  const marketingRoute = marketingPages.some((page) => page === pathname);

  // A marketing document can retain gtag.js after client navigation. Google's
  // documented disable flag stops its automatic collection on other routes.
  useLayoutEffect(() => {
    if (provider !== "ga4" || !measurementId) return;
    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = !marketingRoute;
  }, [provider, measurementId, marketingRoute]);

  useLayoutEffect(() => {
    if (provider !== "ga4" || !measurementId) return;
    const key = `ga-disable-${measurementId}`;
    const setDisabled = (path: string) => {
      (window as unknown as Record<string, unknown>)[key] = !marketingPages.some((page) => page === path);
    };
    const wrap = (original: History["pushState"]): History["pushState"] => (...args) => {
      const previous = (window as unknown as Record<string, unknown>)[key];
      const destination = args[2];
      if (destination != null) {
        try {
          const url = new URL(destination.toString(), window.location.href);
          if (url.origin === window.location.origin) setDisabled(url.pathname);
        } catch { /* Let History handle an invalid destination. */ }
      }
      try { return original.apply(window.history, args); }
      catch (error) {
        (window as unknown as Record<string, unknown>)[key] = previous;
        throw error;
      }
    };
    const pushState = window.history.pushState;
    const replaceState = window.history.replaceState;
    window.history.pushState = wrap(pushState);
    window.history.replaceState = wrap(replaceState);
    const restored = () => setDisabled(window.location.pathname);
    window.addEventListener("popstate", restored);
    window.addEventListener("pageshow", restored);
    return () => {
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
      window.removeEventListener("popstate", restored);
      window.removeEventListener("pageshow", restored);
    };
  }, [provider, measurementId]);

  useEffect(() => {
    if (!marketingRoute || provider !== "ga4" || !measurementId) return;
    let active = true;
    void analyticsEligibility.check().then((eligible) => { if (active) setAllowed(eligible); });
    return () => { active = false; };
  }, [marketingRoute, provider, measurementId]);
  if (!marketingRoute || !allowed || provider !== "ga4" || !measurementId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${measurementId}', { send_page_view: false });`}
      </Script>
    </>
  );
}
