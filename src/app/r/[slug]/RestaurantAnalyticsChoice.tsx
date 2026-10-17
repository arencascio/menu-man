"use client";

import { useEffect, useState } from "react";
import { analyticsEligibility } from "@/lib/analytics/eligibility";
import { marketingEnvironment } from "@/lib/analytics/marketing";
import { isPostHogConfigured } from "@/lib/analytics/posthog";
import { restaurantIdentity } from "@/lib/analytics/restaurant-identity";
import styles from "./restaurant-footer.module.css";

export default function RestaurantAnalyticsChoice({ restaurantId }: { restaurantId: string }) {
  const environment = marketingEnvironment(process.env.NEXT_PUBLIC_VERCEL_ENV);
  const [choice, setChoice] = useState<"hidden" | "on" | "off" | "session-off">("hidden");
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void analyticsEligibility.check().then(async (allowed) => {
        if (!allowed || environment === "unknown" || !isPostHogConfigured()) return;
        const withdrawn = await restaurantIdentity.isWithdrawn(environment, restaurantId, () => allowed);
        if (active && withdrawn !== null) setChoice(withdrawn ? "off" : "on");
      });
    };
    refresh();
    window.addEventListener("storage", refresh);
    return () => { active = false; window.removeEventListener("storage", refresh); };
  }, [environment, restaurantId]);

  if (choice === "hidden") return null;
  async function toggle() {
    if (choice === "on") {
      const persistent = await restaurantIdentity.withdraw(environment, restaurantId, analyticsEligibility.isAllowed);
      setChoice(persistent ? "off" : "session-off");
    } else {
      const resumed = await restaurantIdentity.resume(environment, restaurantId, analyticsEligibility.isAllowed);
      if (resumed) setChoice("on");
    }
  }
  return <div className={styles.analyticsChoice}>
    <button type="button" className={styles.action} onClick={() => void toggle()}>
      {choice === "on" ? "Turn off restaurant analytics" : "Turn on restaurant analytics"}
    </button>
    <span aria-live="polite">{choice === "session-off" ? "Off for this visit; browser storage is unavailable." : ""}</span>
  </div>;
}
