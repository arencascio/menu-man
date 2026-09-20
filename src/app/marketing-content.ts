import type { ReactNode } from "react";

export const CTA_LABELS = {
  primary: "BUILD MY WEBSITE",
  review: "GET MY FREE WEBSITE REVIEW",
  showcase: "I WANT A SITE LIKE THIS",
} as const;

export const PUBLIC_PRICING = {
  monthly: "$149/month",
  setup: "$149 one-time setup",
} as const;

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

export const armandoFeatures = [
  {
    id: "mobile",
    kicker: "Mobile first",
    title: "Built for the phone in your customer's hand.",
    copy: "The menu, hours, location, and ordering path stay easy to reach on a small screen.",
  },
  {
    id: "search",
    kicker: "Menu search",
    title: "Search a huge menu in seconds.",
    copy: "Guests can search dishes and move between categories without wrestling with a PDF.",
  },
  {
    id: "order",
    kicker: "Clear next step",
    title: "Make ordering obvious.",
    copy: "A prominent ordering path connects the website to the restaurant's current workflow.",
  },
  {
    id: "details",
    kicker: "Practical details",
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

export const laterServices = [
  {
    title: "Deeper reporting",
    copy: "Recurring interpretation and recommendations can be added when the deliverable fits your restaurant.",
    label: "Working add-on",
  },
  {
    title: "Delivery app management",
    copy: "Routine menu, price, availability, and hours help across third-party platforms can be scoped separately.",
    label: "Variable service",
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
    answer: "Yes. Your restaurant should own its domain. We can help connect and manage it.",
  },
  {
    question: "What does $149/month include?",
    answer:
      "The managed website, hosting, searchable menu, routine updates, ordering connections, basic SEO and analytics, and ongoing support. It is more than hosting.",
  },
  {
    question: "What does setup cost?",
    answer:
      "Setup is $149 one time for the initial site configuration, menu setup, brand styling, domain connection, and launch.",
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
