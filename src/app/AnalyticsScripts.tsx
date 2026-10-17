"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { analyticsEligibility } from "@/lib/analytics/eligibility";

export default function AnalyticsScripts() {
  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (provider !== "ga4" || !measurementId) return;
    let active = true;
    void analyticsEligibility.check().then((eligible) => { if (active) setAllowed(eligible); });
    return () => { active = false; };
  }, [provider, measurementId]);
  if (!allowed || provider !== "ga4" || !measurementId) return null;

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
