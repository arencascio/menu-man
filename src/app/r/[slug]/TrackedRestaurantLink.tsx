"use client";

import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics/client";

type RestaurantLinkEvent =
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
  target?: "_blank";
};

export default function TrackedRestaurantLink({
  children,
  className,
  eventName,
  href,
  rel,
  restaurantId,
  target,
}: TrackedRestaurantLinkProps) {
  return (
    <a
      className={className}
      href={href}
      target={target}
      rel={rel}
      onClick={() => trackEvent({ name: eventName, restaurantId })}
    >
      {children}
    </a>
  );
}
