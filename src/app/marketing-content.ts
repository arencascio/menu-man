import type { ReactNode } from "react";

export const CTA_LABELS = {
  primary: "BUILD MY WEBSITE",
  review: "GET MY FREE WEBSITE REVIEW",
  showcase: "I WANT A SITE LIKE THIS",
} as const;

export const PUBLIC_PRICING = {
  monthly: "$99/month",
  startupFee: "$299",
  deliveryFirstPlatform: "$25/month",
  deliveryAdditionalPlatform: "+$10/month",
  pickupPerOrder: "$0.50",
  pickupMonthlyCap: "$50/month",
} as const;

export const PUBLIC_CONTACT = { email: "hello@getmenuman.com" } as const;

export const DINER_RESEARCH = {
  menu: "85%",
  website: "80%",
  sourceLabel: "TouchBistro 2024 U.S. Diner Trends Report",
  sourceUrl:
    "https://www.touchbistro.com/wp-content/uploads/2022/09/American_Diner_Report_2024_Final.pdf",
} as const;

export const guestQuestions = [
  "What do you serve?",
  "What does it cost?",
  "Are you open?",
  "Where are you?",
  "How do I order?",
] as const;

export const processSteps = [
  {
    title: "Tell us about your restaurant.",
    copy: "Share your menu, photos, details, and the tools you already use.",
  },
  {
    title: "We build it.",
    copy: "We turn it into a clear, mobile-first restaurant website.",
  },
  {
    title: "We keep it current.",
    copy: "Send us routine changes. We handle the website work.",
  },
] as const;

export const productFeatures = [
  {
    id: "mobile",
    title: "Websites built for smartphones",
    copy: "Everything is easy to use - even on a small screen.",
  },
  {
    id: "search",
    title: "Search a huge menu in seconds.",
    copy: "Guests can search dishes and move between categories without wrestling with a PDF.",
  },
  {
    id: "order",
    title: "Make ordering easy",
    copy: "Give customers a clear path to pickup, delivery, and everything else you do.",
  },
  {
    id: "details",
    title: "Put the important details where customers expect them.",
    copy: "Hours, phone, location, and directions stay close to the decision.",
  },
] as const;

export const includedServices = [
  "Managed, mobile-first restaurant website",
  "Hosting, SSL, deployment, and normal technical upkeep",
  "Restaurant domain connection",
  "Searchable digital menu",
  "Routine menu and content updates",
  "Hours, contact, and location updates",
  "Connections to your existing ordering system",
  "Basic SEO foundation",
  "Basic analytics",
  "Ongoing human support",
] as const;

export const optionalServices = [
  {
    title: "Delivery app updates",
    price: `${PUBLIC_PRICING.deliveryFirstPlatform} for the first supported platform. ${PUBLIC_PRICING.deliveryAdditionalPlatform} for each additional supported platform.`,
    copy: "We handle routine menu, price, photo, hours, and business-profile updates you request. Daily order management and customer support are not included.",
  },
  {
    title: "Menu Man pickup ordering",
    price: `${PUBLIC_PRICING.pickupPerOrder} per completed pickup order, capped at ${PUBLIC_PRICING.pickupMonthlyCap}.`,
    copy: "Optional, only where supported and launch-ready. Payment processing fees are separate. Keep your existing ordering provider with no Menu Man per-order fee.",
  },
] as const;

export const quotedServices = [
  "Professional photography",
  "Logo and brand work",
  "Large menu or catalog cleanup",
  "Major redesigns or new page types",
  "Custom integrations and project work",
] as const;

type Faq = { question: string; answer: ReactNode };

export const faqs: readonly Faq[] = [
  {
    question: "Do I need to update the website myself?",
    answer: "No. Send us routine changes and we will handle the website updates.",
  },
  {
    question: "Can I keep my current ordering system?",
    answer:
      "Yes. We can connect Clover, Square, Toast, DoorDash, Uber Eats, and similar systems so you do not have to replace a workflow that already works.",
  },
  {
    question: "What happens when my menu or hours change?",
    answer: "Send us the change. Routine menu, price, hours, contact, and ordering-link updates are included.",
  },
  {
    question: "Do I keep my domain?",
    answer: "Your restaurant should own and control its domain. Menu Man can help connect it to your website.",
  },
  {
    question: `What does ${PUBLIC_PRICING.monthly} include?`,
    answer:
      `The managed website, hosting, searchable menu, routine updates, ordering connections, basic SEO and analytics, and ongoing support. The one-time startup fee is ${PUBLIC_PRICING.startupFee}.`,
  },
  {
    question: "Do I pay a fee to keep my current ordering provider?",
    answer:
      "No. Links to your existing ordering provider are included in the managed website, with no Menu Man per-order fee. Optional Menu Man pickup ordering is available only where supported and launch-ready; payment processing fees are separate.",
  },
  {
    question: "Can you redesign my current site?",
    answer: "Yes. We can keep what works and rebuild what is getting in your customers' way.",
  },
  {
    question: "What if I do not have a website at all?",
    answer: "That is fine. We can start with your menu, photos, logo, and restaurant details.",
  },
] as const;
