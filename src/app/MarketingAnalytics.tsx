"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { marketingAnalytics, trackMarketing } from "@/lib/analytics/marketing-client";
import { marketingClick } from "@/lib/analytics/marketing";

export default function MarketingAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    marketingAnalytics.visit(pathname, window.location.search);
  }, [pathname]);
  useEffect(() => {
    function clicked(event: MouseEvent) {
      try {
        if (!(event.target instanceof Element)) return;
        const element = event.target.closest<HTMLElement>("[data-marketing-cta], [data-marketing-email]");
        if (!element) return;
        const action = marketingClick(element.dataset);
        if (action) trackMarketing(action);
      } catch { /* Never interfere with the original click. */ }
    }
    // Capture the source page before React/Next handles navigation or modal opening.
    document.addEventListener("click", clicked, true);
    return () => document.removeEventListener("click", clicked, true);
  }, []);
  return null;
}
