"use client";

import { useEffect, useState } from "react";
import AccessRevoked from "../../AccessRevoked";

export default function OrderDetailAccessGuard({ slug, orderId, restaurantName, children }: {
  slug: string;
  orderId: string;
  restaurantName: string;
  children: React.ReactNode;
}) {
  const [accessLost, setAccessLost] = useState<"revoked" | "signed-out" | null>(null);

  useEffect(() => {
    if (accessLost) return;
    let stopped = false;
    const verify = async () => {
      try {
        const response = await fetch(`/api/manage/restaurants/${encodeURIComponent(slug)}/orders/${orderId}`, { cache: "no-store" });
        if (!stopped && response.status === 403) setAccessLost("revoked");
        if (!stopped && response.status === 401) setAccessLost("signed-out");
      } catch {
        // A transient network failure is not evidence that access was revoked.
      }
    };
    const accessEvent = () => setAccessLost("revoked");
    const focus = () => { void verify(); };
    void verify();
    const poll = window.setInterval(() => { void verify(); }, 15_000);
    window.addEventListener("focus", focus);
    window.addEventListener("menu-man-management-access-lost", accessEvent);
    return () => {
      stopped = true;
      window.clearInterval(poll);
      window.removeEventListener("focus", focus);
      window.removeEventListener("menu-man-management-access-lost", accessEvent);
    };
  }, [accessLost, orderId, slug]);

  if (accessLost) return <AccessRevoked restaurantName={restaurantName} signedOut={accessLost === "signed-out"} />;
  return children;
}
