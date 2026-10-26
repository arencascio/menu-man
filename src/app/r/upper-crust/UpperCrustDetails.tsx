import Image from "next/image";
import RestaurantReviews from "../[slug]/RestaurantReviews";
import RestaurantNavigationIcon from "../[slug]/RestaurantNavigationIcon";
import styles from "./upper-crust-details.module.css";
import YelpReviewWidgetScript from "./YelpReviewWidgetScript";

const googleReviews = [
  { quote: "This is a down to earth, old school sandwich shop in the heart of Riverside. It felt like I went back in time, small shop, super friendly service and food was great.", href: "https://maps.app.goo.gl/1BYK7wbyz9az1e7A8", author: "Caleb Provencio", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjXcmfuv-Gmqr6yEnjWe3h7OfYC0UWHqP3gqZyYSUMtnN8OSVNI=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "Took my kids Sunday mid day, and we loved this place. The owner was very friendly.", href: "https://maps.app.goo.gl/xRpypU1SkSqka4sV8", author: "Glo", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjWYZ1Zz5sdGI100TajLXSybsvwYB7pjJn_TiZYeXzBdnEDVrvaj_g=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "I’ve been visiting The Upper Crust for years, and I’ve never been disappointed.", href: "https://maps.app.goo.gl/AAisBPVhhUE6Astw6", author: "Nikki Judge", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjUvNYhWH6PpAkYC7rLa4L9_Ax66oFT2x767cqhNjW8Mv1yARUU=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "The definition of mom and pop shop! The Upper Crust is a small no frills shop with great food! I visited this location twice for lunch, and both times, it did not disappoint!", href: "https://maps.app.goo.gl/AiPAV6rwd4yX8TZP9", author: "Josh Seyed", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjVDi2ckFQGsQiSJacjTAE6HXplSMmWQ-1_Jhfe1uv977WqWQFrK=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "One of the best sandwich shops I’ve been to in the IE! Must be a staple in Riverside. Service was very kind and welcoming.", href: "https://maps.app.goo.gl/FGgKEsUwpJ5xSDeY8", author: "David R Flores", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjW1rjub_S5UCbXvwBRAn3bPP5wMRRryqw0lqWTxaAd0QKKS9VtCoQ=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "A great independent sandwich shop with excellent quality, a nice patio and friendly staff. I was pleasantly surprised with how good the food was. Nothing pretentious, just delicious food done right.", href: "https://maps.app.goo.gl/Ymp6CZL74mgcqGg37", author: "Andrew Arcuri", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjVFAjMoJosfNQgaiySQniPJM-1NMdL9wzk9WwzCFjckpIuW_trv3w=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "Omg talk about a hidden gem! A coworker recommended this cute lil mom n pop restaurant, and holy moly it’s good. The owners are so nice.", href: "https://maps.app.goo.gl/8zUiKQviQ4DjZwv68", author: "Roman W", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocI5yX1hg26mkdHD1GiIKM5UHBaYY7Pv93e7DqOg1tXSlfCg2Q=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "Best and freshest food.", href: "https://maps.app.goo.gl/DYQFHwyELMqztwCW7", author: "Mike S", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocIhpyoopqFHWrLS1vqc8lHnPtWAhchFaYk8erDuI-GYhH3EHQ=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "Love this place. Everyone is so nice. Dog Friendly. Amazing food! Desserts to die for", href: "https://maps.app.goo.gl/vVP6mzsbLJz5iHa1A", author: "Stephany Borja", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocK2LPyL2hYPkDjx_okvO-jIDH3RvSH225sP4pQM_JYrTVYt1Q=w36-h36-p-rp-mo-br100" },
  { quote: "I don’t know which was better, the food of the service! Will definitely be coming back. Got the chicken salad sandwich and it was so good!!", href: "https://maps.app.goo.gl/DtHE4PpqsEdRgDju9", author: "Carrie Le", stars: 5, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjVVg908IPnEuxP2rL_6z-Nzty0j5df5NSwg2DeZqSgo_DuGn8W8gQ=w36-h36-p-rp-mo-ba12-br100" },
  { quote: "The staff were friendly and very helpful. I chose the Italian Sub and had it on a toasted sourdough bread! It was DELICIOUS. I will definitely go back again, worth the trip if your in the area.", href: "https://maps.app.goo.gl/nJy2JYfb7eGPeySP9", author: "Valinda Henry", stars: 4, avatarUrl: "https://lh3.googleusercontent.com/a-/ALV-UjVXXuSz6jt5QVyUaUuFV3IlIZYfUeoXKsKbH5k0lyE3y3vyma1Z=w36-h36-p-rp-mo-ba12-br100" },
] as const;

const amenities = [
  { label: "Quiet", icon: "bird" as const },
  { label: "Casual", icon: "smile" as const },
  { label: "Dogs allowed", icon: "paw-print" },
  { label: "Good for kids", icon: "baby" },
  { label: "Good for groups", icon: "user-round-group" },
  { label: "Outdoor seating", icon: "parasol" },
  { label: "Vegan options", icon: "vegan" },
] as const;

const mapEmbed = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3308.3234907220176!2d-117.37569782428658!3d33.98422377318272!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80dcb1faa203bb63%3A0xa4059051bf1bb9d2!2sThe%20Upper%20Crust%20Sandwich%20Shoppe!5e0!3m2!1sen!2sus!4v1792820543845!5m2!1sen!2sus";

export function UpperCrustAboutSection() {
  return <section className={styles.section} aria-label="Amenities">
    <div className={styles.inner}>
      <ul className={styles.amenities} aria-label="Owner-supplied amenities">
        {amenities.map((amenity) => <li key={amenity.label}>
          {"icon" in amenity && amenity.icon === "bird" ? <RestaurantNavigationIcon icon="bird" /> : null}
          {"icon" in amenity && amenity.icon === "smile" ? <Image src="/img/icons/face-slightly-smiling.svg" alt="" width={20} height={20} /> : null}
          {"icon" in amenity && amenity.icon !== "bird" && amenity.icon !== "smile" ? <AmenityIcon name={amenity.icon} /> : null}
          <span>{amenity.label}</span>
        </li>)}
      </ul>
    </div>
  </section>;
}

export function UpperCrustLocationSection() {
  return <section className={styles.location} aria-label="Map location">
    <div className={styles.inner}>
      <iframe title="Map showing The Upper Crust Sandwich Shoppe in Riverside" src={mapEmbed} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  </section>;
}

function AmenityIcon({ name }: { name: "paw-print" | "baby" | "user-round-group" | "parasol" | "vegan" }) {
  const paths = {
    "paw-print": <><circle cx="11" cy="4" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="4" cy="7" r="2"/><circle cx="7" cy="13" r="2"/><path d="M12 12c-3 0-6 3-6 6a2 2 0 0 0 2 2c1 0 2-1 4-1s3 1 4 1a2 2 0 0 0 2-2c0-3-3-6-6-6Z"/></>,
    baby: <><circle cx="12" cy="5" r="3"/><path d="M8 12a4 4 0 0 1 8 0v2h3a2 2 0 0 1 2 2v1H3v-1a2 2 0 0 1 2-2h3zM8 17v3m8-3v3M10 12h.01M14 12h.01"/></>,
    "user-round-group": <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    parasol: <><path d="M12 12v8a2 2 0 0 0 4 0"/><path d="M12 2v2m8 8a8 8 0 0 0-16 0c2-1 4-1 8 0s6 1 8 0Z"/></>,
    vegan: <><path d="M11 20A7 7 0 0 1 4 13c0-6 8-9 16-9 0 8-3 16-9 16Z"/><path d="M8 16c2-2 5-4 9-6"/></>,
  };
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function UpperCrustDetails() {
  return <>
    <div className={styles.googleReviews}>
    <YelpReviewWidgetScript />
    <RestaurantReviews title="Reviews" autoAdvance autoAdvanceInterval={11000} controlsPlacement="sides" svgControls items={googleReviews.map(({ quote, href, author, stars, avatarUrl }) => ({
      quote,
      attribution: author,
      stars,
      avatarUrl,
      source: { label: "View on Google Maps", href, icon: "google" },
    }))} yelpEmbeds={[
      { reviewId: "uFgzOfNbZyjh0QqCWNBwvQ", userId: "m4DXFDZXiODdha_yhwZsgQ" },
      { reviewId: "eR40QqkXykPzWkunBsJLHQ", userId: "_lDW6CHf3N9O_2ppeL4vTw" },
      { reviewId: "7nNmA6Ir_ZFQ8lD8UJn8cg", userId: "z9cIFIgrqBTjQmoN628NXg" },
    ]} />
    </div>

  </>;
}
