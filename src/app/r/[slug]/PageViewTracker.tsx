"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics/client";
import { createRestaurantPageVisits } from "@/lib/analytics/restaurant";
import type { RestaurantPageType } from "@/lib/analytics/types";

const visits = createRestaurantPageVisits(trackEvent);
type PageViewTrackerProps = { restaurantId: string; pageType: RestaurantPageType; path: string };

// Observe departures too, and count restored browser documents as revisits.
export function RestaurantNavigationObserver() {
  const pathname = usePathname();
  useEffect(() => { visits.observe(pathname); }, [pathname]);
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) visits.restore(window.location.pathname);
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);
  return null;
}

export default function PageViewTracker({ restaurantId, pageType, path }: PageViewTrackerProps) {
  const pathname = usePathname();
  useEffect(() => {
    visits.visit(restaurantId, pageType, path, pathname);
  }, [restaurantId, pageType, path, pathname]);

  return null;
}
