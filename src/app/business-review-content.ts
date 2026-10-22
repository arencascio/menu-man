import { PUBLIC_PRICING } from "./marketing-content";

// Owner-directed policy copy (2026-10-22). The export window does not imply
// an automatic deletion date or guarantee restoration of the hosted website.
export const cancellationTopics = [
  {
    id: "cancel",
    title: "Cancel anytime.",
    copy: "You can cancel anytime without a cancellation penalty. Choose immediate website shutdown or continued service through your paid-through date.",
  },
  {
    id: "ownership-and-data",
    title: "Your domain and information remain yours.",
    copy: "Your restaurant-owned domain stays with your restaurant. You can request a standard export of your restaurant-owned raw menu and business information within 90 days after cancellation. Website design and functionality may be retained longer, but restoration is not guaranteed.",
  },
  {
    id: "billing",
    title: "Simple, predictable billing.",
    copy: `The one-time ${PUBLIC_PRICING.startupFee} setup payment is charged at project start. There are no monthly charges while we build. ${PUBLIC_PRICING.monthly} billing begins when your completed website launches and renews monthly on the launch-date anniversary. Setup and subscription payments are nonrefundable, except where required by law. There are no prorated refunds for unused subscription time, except where required by law. If you return after cancelling, reactivation or setup fees may apply.`,
  },
] as const;
