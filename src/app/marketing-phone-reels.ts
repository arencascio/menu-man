export type PhoneReel = {
  id: string;
  label: string;
  description: string;
  sources: readonly { src: string; type: "video/mp4" | "video/webm" }[];
  poster: string;
  posterAlt: string;
  caption: string;
  features: readonly [string, string, string];
  compactFeatures?: readonly [string, string, string];
};

// Approved public recordings only. Management requires separate Staging-only composition.
export const marketingPhoneReels = [
  {
    id: "website", label: "Website", description: "Super Tacos restaurant website recording",
    sources: [{ src: "/brand/previews/super-tacos-home.mp4", type: "video/mp4" }],
    poster: "/brand/previews/featurettes/reel-poster.webp", posterAlt: "Super Tacos fictional restaurant homepage",
    caption: "Super Tacos · fictional restaurant demo.",
    features: ["Custom website", "Clear ordering path", "Hours & location"],
    compactFeatures: ["Website", "Ordering path", "Hours & map"],
  },
  {
    id: "ordering", label: "Ordering", description: "Super Tacos menu and sample ordering recording",
    sources: [{ src: "/brand/previews/super-tacos-ordering.mp4", type: "video/mp4" }],
    poster: "/brand/previews/featurettes/reel-poster.webp", posterAlt: "Super Tacos homepage still; ordering preview uses video",
    caption: "Super Tacos · fictional demo. No real orders or payments.",
    features: ["Searchable menu", "Item customization", "Sample cart"],
    compactFeatures: ["Menu", "Options", "Cart"],
  },
] as const satisfies readonly PhoneReel[];
