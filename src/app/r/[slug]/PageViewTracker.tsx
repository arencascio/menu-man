"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/client";

type PageViewTrackerProps = { restaurantId: string };

export default function PageViewTracker({ restaurantId }: PageViewTrackerProps) {
  useEffect(() => {
    trackEvent({ name: "page_view", restaurantId });
  }, [restaurantId]);

  return null;
}
