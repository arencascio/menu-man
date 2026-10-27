import Image from "next/image";
import { upperCrustLinks } from "@/lib/upper-crust/site-content";
import { upperCrustProtectedMediaUrl } from "@/lib/upper-crust/protected-media";
import styles from "./upper-crust-details.module.css";

// Static provider summaries, checked against the public business listings.
// These are not live counters or a license to reproduce individual reviews.
export default function UpperCrustSocialBar() {
  return <nav className={styles.socialStrip} aria-label="Social and review links">
    <a className={styles.reviewLink} href={upperCrustLinks.google} target="_blank" rel="noopener noreferrer nofollow" aria-label="Google Reviews: 4.7 out of 5, 401 reviews. Checked October 27, 2026">
      <span className={styles.googleMark}><Image src={upperCrustProtectedMediaUrl("google-g.png")} alt="Google" width={60} height={60} unoptimized /></span>
      <span><strong>4.7<small>out of 5 on Google</small></strong><small>401 reviews</small><small>Checked Oct 27, 2026</small></span>
    </a>
    <a className={styles.reviewLink} href={upperCrustLinks.yelp} target="_blank" rel="noopener noreferrer nofollow" aria-label="Yelp Reviews: 4.5 out of 5, 881 reviews. Checked October 27, 2026">
      <Image src={upperCrustProtectedMediaUrl("yelp-favicon.svg")} alt="Yelp" width={32} height={32} unoptimized />
      <span><strong>4.5<small>out of 5 on Yelp</small></strong><small>881 reviews</small><small>Checked Oct 27, 2026</small></span>
    </a>
    <a href={upperCrustLinks.facebook} target="_blank" rel="noopener noreferrer nofollow"><Image src="/img/super-tacos/approved/social/facebook.png" alt="" width={32} height={32} />Facebook</a>
    <a href={upperCrustLinks.instagram} target="_blank" rel="noopener noreferrer nofollow"><Image src="/img/super-tacos/approved/social/instagram.png" alt="" width={32} height={32} />Instagram</a>
  </nav>;
}
