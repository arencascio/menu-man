import Image from "next/image";
import { upperCrustLinks } from "@/lib/upper-crust/site-content";
import { upperCrustProtectedMediaUrl } from "@/lib/upper-crust/protected-media";
import styles from "./upper-crust-details.module.css";

export default function UpperCrustSocialBar({ showDisclosure = true }: { showDisclosure?: boolean }) {
  return <>
    <div className={styles.socialStrip} aria-label="Social and review links">
      <a href={upperCrustLinks.google} target="_blank" rel="noopener noreferrer nofollow" className={`${styles.reviewLink} ${styles.googleLink}`} aria-label="Google reviews: 4.7 out of 5, 401 reviews, checked October 27, 2026">
        <Image src={upperCrustProtectedMediaUrl("google-symbol.svg")} alt="Google" width={36} height={36} unoptimized />
        <span><strong>4.7 / 5</strong><small>Google · 401 reviews</small></span>
      </a>
      <a href={upperCrustLinks.yelp} target="_blank" rel="noopener noreferrer nofollow" className={styles.reviewLink} aria-label="Yelp reviews: 4.5 out of 5, 881 reviews, checked October 27, 2026">
        <Image src={upperCrustProtectedMediaUrl("yelp-favicon.svg")} alt="Yelp" width={32} height={32} unoptimized />
        <span><strong>4.5 / 5</strong><small>Yelp · 881 reviews</small></span>
      </a>
      <a href={upperCrustLinks.facebook} target="_blank" rel="noopener noreferrer nofollow" aria-label="Facebook">
        <Image className={styles.facebookMark} src={upperCrustProtectedMediaUrl("facebook-wordmark.svg")} alt="Facebook" width={116} height={28} unoptimized />
      </a>
      <a href={upperCrustLinks.instagram} target="_blank" rel="noopener noreferrer nofollow" aria-label="Instagram">
        <Image src={upperCrustProtectedMediaUrl("instagram-2022.svg")} alt="Instagram" width={32} height={32} unoptimized />
      </a>
    </div>
    {showDisclosure ? <p className={styles.socialDisclosure}>Ratings checked October 27, 2026. Review counts may change; these are snapshots, not live data.</p> : null}
  </>;
}
