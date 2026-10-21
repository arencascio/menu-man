// Owner-approved working policy (2026-10-21). Publication is still separately
// gated. Export request timing does not establish a data-deletion deadline.
export const cancellationTopics = [
  {
    id: "cancellation",
    title: "Cancel whenever you need to",
    copy: "You can cancel at any time, without a cancellation penalty. Email Menu Man to arrange the end of your managed service and discuss your handoff.",
  },
  {
    id: "managed-service",
    title: "What happens to the website?",
    copy: "Managed hosting and website updates end when your cancellation takes effect. Plan your next website before the service ends so customers can keep finding you.",
  },
  {
    id: "domain",
    title: "Your domain stays yours",
    copy: "You keep control of your restaurant-owned domain and can connect it to your next website. Using Menu Man does not transfer domain ownership to us.",
  },
  {
    id: "export",
    title: "Take your information with you",
    copy: "Request an export of your restaurant-owned raw menu and business information within two weeks after cancellation. A standard export is included at no additional fee, giving your next provider a useful starting point.",
  },
  {
    id: "retention",
    title: "A note about the request window",
    copy: "The two-week window is for requesting your export. It does not set a deletion deadline for stored data or backups.",
  },
] as const;
