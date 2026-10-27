import RestaurantReviews from "../[slug]/RestaurantReviews";
import { isUpperCrustPreviewPresentation } from "@/lib/upper-crust/preview-presentation";
import { upperCrustProtectedMediaUrl } from "@/lib/upper-crust/protected-media";
import YelpReviewWidgetScript from "./YelpReviewWidgetScript";
import styles from "./upper-crust-details.module.css";

// Internal SSO Preview fixture only. Reviewer marketing-use permission is unresolved;
// do not expose or enable these excerpts in public or production presentation.
const googleReviews = [
  { quote: "This is a down to earth, old school sandwich shop in the heart of Riverside. It felt like I went back in time, small shop, super friendly service and food was great.", href: "https://maps.app.goo.gl/1BYK7wbyz9az1e7A8", author: "Caleb Provencio", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjXcmfuv-Gmqr6yEnjWe3h7OfYC0UWHqP3gqZyYSUMtnN8OSVNI=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "Took my kids Sunday mid day, and we loved this place. The owner was very friendly.", href: "https://maps.app.goo.gl/xRpypU1SkSqka4sV8", author: "Glo", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjWYZ1Zz5sdGI100TajLXSybsvwYB7pjJn_TiZYeXzBdnEDVrvaj_g=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "Iâ€™ve been visiting The Upper Crust for years, and Iâ€™ve never been disappointed.", href: "https://maps.app.goo.gl/AAisBPVhhUE6Astw6", author: "Nikki Judge", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjUvNYhWH6PpAkYC7rLa4L9_Ax66oFT2x767cqhNjW8Mv1yARUU=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "The definition of mom and pop shop! The Upper Crust is a small no frills shop with great food! I visited this location twice for lunch, and both times, it did not disappoint!", href: "https://maps.app.goo.gl/AiPAV6rwd4yX8TZP9", author: "Josh Seyed", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjVDi2ckFQGsQiSJacjTAE6HXplSMmWQ-1_Jhfe1uv977WqWQFrK=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "One of the best sandwich shops Iâ€™ve been to in the IE! Must be a staple in Riverside. Service was very kind and welcoming.", href: "https://maps.app.goo.gl/FGgKEsUwpJ5xSDeY8", author: "David R Flores", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjW1rjub_S5UCbXvwBRAn3bPP5wMRRryqw0lqWTxaAd0QKKS9VtCoQ=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "A great independent sandwich shop with excellent quality, a nice patio and friendly staff. I was pleasantly surprised with how good the food was. Nothing pretentious, just delicious food done right.", href: "https://maps.app.goo.gl/Ymp6CZL74mgcqGg37", author: "Andrew Arcuri", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjVFAjMoJosfNQgaiySQniPJM-1NMdL9wzk9WwzCFjckpIuW_trv3w=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "Omg talk about a hidden gem! A coworker recommended this cute lil mom n pop restaurant, and holy moly itâ€™s good. The owners are so nice.", href: "https://maps.app.goo.gl/8zUiKQviQ4DjZwv68", author: "Roman W", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocI5yX1hg26mkdHD1GiIKM5UHBaYY7Pv93e7DqOg1tXSlfCg2Q=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "Best and freshest food.", href: "https://maps.app.goo.gl/DYQFHwyELMqztwCW7", author: "Mike S", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocIhpyoopqFHWrLS1vqc8lHnPtWAhchFaYk8erDuI-GYhH3EHQ=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "Love this place. Everyone is so nice. Dog Friendly. Amazing food! Desserts to die for", href: "https://maps.app.goo.gl/vVP6mzsbLJz5iHa1A", author: "Stephany Borja", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocK2LPyL2hYPkDjx_okvO-jIDH3RvSH225sP4pQM_JYrTVYt1Q=w36-h36-p-rp-mo-br100" },
  { quote: "I donâ€™t know which was better, the food of the service! Will definitely be coming back. Got the chicken salad sandwich and it was so good!!", href: "https://maps.app.goo.gl/DtHE4PpqsEdRgDju9", author: "Carrie Le", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjVVg908IPnEuxP2rL_6z-Nzty0j5df5NSwg2DeZqSgo_DuGn8W8gQ=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "The staff were friendly and very helpful. I chose the Italian Sub and had it on a toasted sourdough bread! It was DELICIOUS. I will definitely go back again, worth the trip if your in the area.", href: "https://maps.app.goo.gl/nJy2JYfb7eGPeySP9", author: "Valinda Henry", stars: 4, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjVXXuSz6jt5QVyUaUuFV3IlIZYfUeoXKsKbH5k0lyE3y3vyma1Z=w36-h36-p-rp-mo-ba12-br100" },
] as const;

const yelpEmbeds = [
  { reviewId: "uFgzOfNbZyjh0QqCWNBwvQ", userId: "m4DXFDZXiODdha_yhwZsgQ" },
  { reviewId: "eR40QqkXykPzWkunBsJLHQ", userId: "_lDW6CHf3N9O_2ppeL4vTw" },
  { reviewId: "7nNmA6Ir_ZFQ8lD8UJn8cg", userId: "z9cIFIgrqBTjQmoN628NXg" },
] as const;
export default function UpperCrustReviews() {
  const showPrivateGoogleReviews = isUpperCrustPreviewPresentation();
  return <div className={styles.googleReviews}>
    <RestaurantReviews title="Reviews" items={showPrivateGoogleReviews ? googleReviews.map(({ quote, href, author, stars, avatarUrl }) => ({
      quote,
      attribution: author,
      stars,
      avatarUrl,
      source: { label: "View on Google Maps", href, icon: "google" as const, iconUrl: upperCrustProtectedMediaUrl("google-symbol.svg") },
    })) : []} yelpEmbeds={yelpEmbeds}
      autoAdvance autoAdvanceInterval={11000} controlsPlacement="sides" svgControls />
    <YelpReviewWidgetScript />
  </div>;
}
