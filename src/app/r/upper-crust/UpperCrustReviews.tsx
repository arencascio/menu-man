"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import RestaurantReviews from "../[slug]/RestaurantReviews";
import YelpReviewWidgetScript from "./YelpReviewWidgetScript";
import { upperCrustLinks } from "@/lib/upper-crust/site-content";
import styles from "./upper-crust-details.module.css";

const yelpEmbeds = [
  { reviewId: "uFgzOfNbZyjh0QqCWNBwvQ", userId: "m4DXFDZXiODdha_yhwZsgQ" },
  { reviewId: "eR40QqkXykPzWkunBsJLHQ", userId: "_lDW6CHf3N9O_2ppeL4vTw" },
  { reviewId: "7nNmA6Ir_ZFQ8lD8UJn8cg", userId: "z9cIFIgrqBTjQmoN628NXg" },
] as const;
const sourceLinks = [
  { label: "Google Reviews", href: upperCrustLinks.google },
  { label: "Yelp Reviews", href: upperCrustLinks.yelp },
] as const;

// The layout owns this component so Next navigation doesn't destroy provider
// iframes or require the one-shot official widget script to run again.
export default function UpperCrustReviews() {
  const isHomepage = usePathname() === "/r/upper-crust";
  const [visited, setVisited] = useState(isHomepage);
  if (isHomepage && !visited) setVisited(true);
  if (!visited) return null;

  return <div hidden={!isHomepage} className={styles.reviews}>
    <RestaurantReviews title="Reviews" items={[]} yelpEmbeds={yelpEmbeds}
      sourceLinks={sourceLinks} autoAdvance={isHomepage} controlsPlacement="sides" svgControls />
    <YelpReviewWidgetScript />
  </div>;
}
