"use client";

import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics/client";

export type RestaurantLinkEvent =
  | "phone_clicked"
  | "directions_clicked"
  | "delivery_clicked"
  | "pickup_clicked";

type TrackedRestaurantLinkProps = {
  children: ReactNode;
  className?: string;
  eventName: RestaurantLinkEvent;
  href: string;
  rel?: string;
  restaurantId: string;
  tabIndex?: number;
  target?: "_blank";
};

export default function TrackedRestaurantLink({
  children,
  className,
  eventName,
  href,
  rel,
  restaurantId,
  tabIndex,
  target,
}: TrackedRestaurantLinkProps) {
  return (
    <a
      className={className}
      href={href}
      target={target}
      rel={rel}
      tabIndex={tabIndex}
      onClick={() => trackEvent({ name: eventName, restaurantId })}
    >
      {children}
    </a>
  );
}
