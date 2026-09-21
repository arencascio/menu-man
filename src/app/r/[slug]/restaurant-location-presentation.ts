// Restaurant-owned page presentation. Shared components contain no client facts.
export type RestaurantLocationPresentation = {
  eyebrow: string;
  heading: string;
  fallbackStory: string;
  mapEmbedUrl?: string;
  streetViewEmbedUrl?: string;
};

export const restaurantLocationPresentations: Readonly<Partial<Record<string, RestaurantLocationPresentation>>> = {
  armandos: {
    eyebrow: "About Armando's",
    heading: "Good food. A place to find us.",
    fallbackStory: "Explore Armando's Mexican Food menu, from breakfast plates to street tacos, burritos, and combination plates.",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3311.889484116204!2d-117.2066667!3d33.8925!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80dca7171f6d308f%3A0x28220185e3313f9d!2sArmando's%20Mexican%20Food!5e0!3m2!1sen!2sus!4v1789973139894!5m2!1sen!2sus",
    streetViewEmbedUrl: "https://www.google.com/maps/embed?pb=!4v1789973172144!6m8!1m7!1sMuxdeHXNuV7F74E4fLiY5A!2m2!1d33.89246965376266!2d-117.2065247621734!3f337.7043!4f5.293909999999997!5f0.7820865974627469",
  },
};
