import Image from "next/image";
import { upperCrustLinks } from "@/lib/upper-crust/site-content";
import styles from "./upper-crust-details.module.css";

const amenities = [
  { label: "Quiet", icon: "bird" as const },
  { label: "Casual", icon: "face-slightly-smiling" as const },
  { label: "Dogs allowed", icon: "paw-print" },
  { label: "Good for kids", icon: "baby" },
  { label: "Good for groups", icon: "users-round" },
  { label: "Outdoor seating", icon: "umbrella" },
  { label: "Vegan options", icon: "vegan" },
] as const;

export function UpperCrustAboutSection() {
  return <section className={styles.section} aria-label="Amenities">
    <div className={styles.inner}>
      <ul className={styles.amenities} aria-label="Owner-supplied amenities">
        {amenities.map((amenity) => <li key={amenity.label}>
          <Image src={`/img/icons/${amenity.icon}.svg`} alt="" width={20} height={20} />
          <span>{amenity.label}</span>
        </li>)}
      </ul>
    </div>
  </section>;
}

export function UpperCrustLocationSection() {
  return <section className={styles.location} aria-label="Map location">
    <div className={styles.inner}>
      <div>
        <iframe title="Map showing The Upper Crust Sandwich Shoppe in Riverside" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3308.3234907220176!2d-117.37569782428658!3d33.98422377318272!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80dcb1faa203bb63%3A0xa4059051bf1bb9d2!2sThe%20Upper%20Crust%20Sandwich%20Shoppe!5e0!3m2!1sen!2sus!4v1792820543845!5m2!1sen!2sus" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        <a className={styles.directions} href={upperCrustLinks.directions} target="_blank" rel="noopener noreferrer nofollow">Open directions in Google Maps</a>
      </div>
    </div>
  </section>;
}
