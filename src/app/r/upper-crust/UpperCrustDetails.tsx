import Image from "next/image";
import styles from "./upper-crust-details.module.css";

const amenities = [
  { label: "Quiet", icon: "/img/icons/bird.svg", size: 18 },
  { label: "Casual", icon: "/img/icons/face-slightly-smiling.svg", size: 20 },
  { label: "Dogs allowed", icon: "/img/icons/paw-print.svg", size: 20 },
  { label: "Good for kids", icon: "/img/icons/baby.svg", size: 20 },
  { label: "Good for groups", icon: "/img/icons/user-round-group.svg", size: 20 },
  { label: "Outdoor seating", icon: "/img/icons/parasol.svg", size: 20 },
  { label: "Vegan options", icon: "/img/icons/vegan.svg", size: 20 },
] as const;

export function UpperCrustAboutSection() {
  return <section className={styles.section} aria-label="Amenities">
    <div className={styles.inner}>
      <ul className={styles.amenities} aria-label="Owner-supplied amenities">
        {amenities.map((amenity) => <li key={amenity.label}>
          <Image src={amenity.icon} alt="" width={amenity.size} height={amenity.size} unoptimized />
          <span>{amenity.label}</span>
        </li>)}
      </ul>
    </div>
  </section>;
}

export function UpperCrustLocationSection() {
  return <section className={styles.location} aria-label="Map location">
    <div className={styles.inner}>
      <iframe title="Map showing The Upper Crust Sandwich Shoppe in Riverside" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3308.3234907220176!2d-117.37569782428658!3d33.98422377318272!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80dcb1faa203bb63%3A0xa4059051bf1bb9d2!2sThe%20Upper%20Crust%20Sandwich%20Shoppe!5e0!3m2!1sen!2sus!4v1792820543845!5m2!1sen!2sus" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  </section>;
}
