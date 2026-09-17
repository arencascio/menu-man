"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAdminBrowserClient } from "@/lib/supabase/admin-browser";
import AccessRevoked from "../../AccessRevoked";

export default function OrderDetailAccessGuard({ slug, orderId, restaurantId, restaurantName, children }: {
  slug: string;
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [accessLost, setAccessLost] = useState<"revoked" | "signed-out" | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/manage/restaurants/${encodeURIComponent(slug)}/orders/${orderId}`, { cache: "no-store" });
      if (response.status === 403) setAccessLost("revoked");
      else if (response.status === 401) setAccessLost("signed-out");
      else if (response.ok) router.refresh();
    } catch {
      // Focus, online, realtime, and polling retries remain advisory.
    }
  }, [orderId, router, slug]);

  useEffect(() => {
    if (accessLost) return;
    const accessEvent = () => setAccessLost("revoked");
    const refreshPage = () => { void refresh(); };
    const poll = window.setInterval(refreshPage, 15_000);
    window.addEventListener("focus", refreshPage);
    window.addEventListener("online", refreshPage);
    window.addEventListener("menu-man-management-access-lost", accessEvent);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", refreshPage);
      window.removeEventListener("online", refreshPage);
      window.removeEventListener("menu-man-management-access-lost", accessEvent);
    };
  }, [accessLost, refresh]);

  useEffect(() => {
    if (accessLost) return;
    const supabase = createAdminBrowserClient();
    const channel = supabase.channel(`restaurant:${restaurantId}:orders`, { config: { private: true } })
      .on("broadcast", { event: "order_changed" }, (message) => {
        const changedOrderId = (message.payload as { orderId?: unknown } | undefined)?.orderId;
        if (changedOrderId === orderId) void refresh();
      })
      .subscribe();
    const browserChannel = typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(`menu-man-orders:${restaurantId}`);
    if (browserChannel) browserChannel.onmessage = (event) => {
      if ((event.data as { orderId?: unknown } | null)?.orderId === orderId) void refresh();
    };
    return () => { void supabase.removeChannel(channel); browserChannel?.close(); };
  }, [accessLost, orderId, refresh, restaurantId]);

  if (accessLost) return <AccessRevoked restaurantName={restaurantName} slug={slug} signedOut={accessLost === "signed-out"} />;
  return children;
}
