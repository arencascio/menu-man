import Image from "next/image";
import RestaurantNavigationIcon from "../[slug]/RestaurantNavigationIcon";
import { upperCrustLinks } from "@/lib/upper-crust/site-content";
import styles from "./upper-crust-details.module.css";

const amenities = [
  { label: "Quiet", icon: "bird" as const },
  { label: "Casual", icon: "smile" as const },
  { label: "Dogs allowed", icon: "paw-print" },
  { label: "Good for kids", icon: "baby" },
  { label: "Good for groups", icon: "user-round-group" },
  { label: "Outdoor seating", icon: "parasol" },
  { label: "Vegan options", icon: "vegan" },
] as const;

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
      <div>
        <iframe title="Map showing The Upper Crust Sandwich Shoppe in Riverside" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3308.3234907220176!2d-117.37569782428658!3d33.98422377318272!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80dcb1faa203bb63%3A0xa4059051bf1bb9d2!2sThe%20Upper%20Crust%20Sandwich%20Shoppe!5e0!3m2!1sen!2sus!4v1792820543845!5m2!1sen!2sus" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        <a className={styles.directions} href={upperCrustLinks.directions} target="_blank" rel="noopener noreferrer nofollow">Open directions in Google Maps</a>
      </div>
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
