"use client";

import type { ReactNode } from "react";
import { trackRestaurantAction, type RestaurantActionContext, type RestaurantLinkEvent } from "@/lib/analytics/restaurant-actions";

export type { RestaurantLinkEvent } from "@/lib/analytics/restaurant-actions";

type TrackedRestaurantLinkProps = RestaurantActionContext & {
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
  surface,
  placement,
  providerId,
  pickupAction,
}: TrackedRestaurantLinkProps) {
  return (
    <a
      className={className}
      href={href}
      target={target}
      rel={rel}
      tabIndex={tabIndex}
      onClick={() => trackRestaurantAction(eventName, restaurantId, { surface, placement, providerId, pickupAction })}
    >
      {children}
    </a>
  );
}
