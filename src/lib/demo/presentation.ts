// Client presentation configuration only. Commerce authority stays in the DB.
import type { CSSProperties } from "react";
import theme from "./theme.json";
import { isDemoRestaurant } from "./policy";
import { superTacosContent } from "./showcase-content";

export function demoPageStyle(restaurantId: string): CSSProperties | undefined {
  if (!isDemoRestaurant(restaurantId)) return undefined;
  return {
    "--theme-primary": theme.primary, "--theme-accent": theme.accent,
    "--theme-background": theme.background, "--theme-surface": theme.surface,
    "--theme-text": theme.text, "--theme-muted-text": theme.mutedText,
  } as CSSProperties;
}

export const superTacosHero = {
  layout: "full-photo" as const,
  treatment: "showcase" as const,
  showLogo: false,
  headline: "Good days. Great tacos.",
  supportingText: "Warm tortillas. A little salsa heat. Street tacos and loaded burritos worth slowing down for.",
  imageAlt: "Illustrative photograph of freshly prepared tacos with colorful garnishes",
  imageUrl: "/img/super-tacos/approved/carnitas-tacos.webp",
  imagePosition: "50% 55%",
  mobileImagePosition: "65% 50%",
  primaryAction: { label: "Order Pickup", href: "/r/super-tacos/menu", trackingEvent: "pickup_clicked" as const },
};

export const superTacosShowcase = {
  ...superTacosContent,
  shrinkNavigationOnScroll: true,
  footerReveal: true,
  wordmarkOnly: false,
  deliveryOptions: [
    { displayName: "DoorDash", providerKey: "doordash" },
    { displayName: "Uber Eats", providerKey: "uber_eats" },
    { displayName: "Grubhub", providerKey: "grubhub" },
  ],
  hours: {
    heading: "Make time for tacos.",
    description: "A quick lunch, a long catch-up, or one more round of chips. There's always room for something good.",
    unavailableLocationMessage: "Our fictional location is part of this showcase.",
  },
  location: {
    neighborhoodUrl: "https://www.google.com/maps/search/?api=1&query=Tyler+Street+%26+Magnolia+Avenue%2C+Riverside%2C+CA+92503",
    disclosure: "Super Tacos is a demonstration restaurant. Location details are illustrative.",
  },
  gallery: {
    title: "A little of what you love.",
    slides: [
      { menuItemName: "Street Taco", menuItemId: "20000000-0000-4000-8000-000000000201", imageAlt: "Illustrative tacos with onion, cilantro, and salsa" },
      { menuItemName: "Burrito", menuItemId: "20000000-0000-4000-8000-000000000205", imageAlt: "Illustrative photograph of a generously filled burrito" },
      { menuItemName: "Loaded Nachos", menuItemId: "20000000-0000-4000-8000-000000000208", imageAlt: "Illustrative nachos piled with fresh toppings" },
      { menuItemName: "Cinnamon Churros", menuItemId: "20000000-0000-4000-8000-000000000228", imageAlt: "Illustrative cinnamon sugar churros" },
      { menuItemName: "Breakfast Quesadilla", menuItemId: "20000000-0000-4000-8000-000000000224", imageAlt: "Breakfast quesadilla with eggs and fresh toppings" },
    ],
  },
};
