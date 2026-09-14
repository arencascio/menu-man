import "server-only";

import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

function capabilityCookieName(orderId: string) {
  return `menu_man_payment_${orderId.replaceAll("-", "")}`;
}

function orderIdFromCookieName(name: string) {
  const compact = name.match(/^menu_man_payment_([0-9a-f]{32})$/i)?.[1];
  if (!compact) return null;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase();
}

export async function getGuestPaymentCapability(orderId: string) {
  return (await cookies()).get(capabilityCookieName(orderId))?.value || null;
}

export async function listGuestPaymentCapabilities() {
  return (await cookies()).getAll().flatMap((cookie) => {
    const orderId = orderIdFromCookieName(cookie.name);
    return orderId ? [{ orderId, checkoutToken: cookie.value }] : [];
  });
}

export function setGuestPaymentCapability(
  response: NextResponse,
  orderId: string,
  checkoutToken: string,
  expiresAt: string,
) {
  response.cookies.set(capabilityCookieName(orderId), checkoutToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
    priority: "high",
  });
}

export function clearGuestPaymentCapability(response: NextResponse, orderId: string) {
  response.cookies.set(capabilityCookieName(orderId), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    priority: "high",
  });
}
