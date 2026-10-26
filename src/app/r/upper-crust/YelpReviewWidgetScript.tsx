"use client";

import Script from "next/script";

const yelpWidgetScriptUrl = "https://www.yelp.com/embed/widgets.js";

export default function YelpReviewWidgetScript() {
  return <Script
    id="yelp-review-widgets"
    src={yelpWidgetScriptUrl}
    strategy="afterInteractive"
  />;
}
