import type { Metadata } from "next";
import Image from "next/image";
import { upperCrust } from "@/lib/upper-crust/config";
import { upperCrustHours, upperCrustLinks, upperCrustStorefrontPhoto } from "@/lib/upper-crust/site-content";
import { upperCrustProtectedMediaUrl } from "@/lib/upper-crust/protected-media";
import styles from "../upper-crust.module.css";
import { UpperCrustAboutSection, UpperCrustLocationSection } from "../UpperCrustDetails";
import detailStyles from "../upper-crust-details.module.css";

export const metadata: Metadata = { title: { absolute: "About Us | Upper Crust private concept" } };

export default function UpperCrustAbout() {
  return <main id="main-content" className={styles.interiorPage}>
    <header className={styles.interiorIntro}><h1>About Us</h1></header>
    <div className={detailStyles.socialStrip} aria-label="Social and review links">
      <a href={upperCrustLinks.google} target="_blank" rel="noopener noreferrer nofollow" className={detailStyles.reviewLink} aria-label="Google Reviews: 4.7 out of 5, 400 reviews. Checked October 24, 2026"><Image src={upperCrustProtectedMediaUrl("google-g.png")} alt="Google" width={32} height={32} unoptimized/><span><strong>4.7</strong><small>400 reviews</small></span></a>
      <a href={upperCrustLinks.yelp} target="_blank" rel="noopener noreferrer nofollow" className={detailStyles.reviewLink} aria-label="Yelp Reviews: 4.5 out of 5, 881 reviews. Checked October 24, 2026"><Image src={upperCrustProtectedMediaUrl("yelp-favicon.svg")} alt="Yelp" width={32} height={32} unoptimized/><span><strong>4.5</strong><small>881 reviews</small></span></a>
      <a href={upperCrustLinks.facebook} target="_blank" rel="noopener noreferrer nofollow"><Image src="/img/super-tacos/approved/social/facebook.png" alt="Facebook" width={32} height={32} unoptimized/></a>
      <a href={upperCrustLinks.instagram} target="_blank" rel="noopener noreferrer nofollow"><Image src="/img/super-tacos/approved/social/instagram.png" alt="Instagram" width={32} height={32} unoptimized/></a>
    </div>
    <div className={styles.aboutGrid}>
      <div className={styles.aboutLeftColumn}>
        <div className={styles.aboutMap}><UpperCrustLocationSection /></div>
        <section className={`${styles.neighborhoodCard} ${styles.aboutPhoto}`} aria-label="Storefront photograph">
          <figure><Image src={upperCrustStorefrontPhoto.src} alt={upperCrustStorefrontPhoto.alt} width={upperCrustStorefrontPhoto.width} height={upperCrustStorefrontPhoto.height} unoptimized loading="eager"/></figure>
        </section>
      </div>
      <div className={styles.aboutRightColumn}>
        <section className={styles.hoursCard} aria-labelledby="hours-heading"><h2 id="hours-heading">Contact</h2><address><a className={styles.addressLink} href={upperCrustLinks.directions} target="_blank" rel="noopener noreferrer nofollow"><Image src="/img/icons/map-pinned.svg" alt="" width={18} height={18} />{upperCrust.address}, {upperCrust.locality}</a><a className={styles.phoneLink} href={upperCrustLinks.phone}><Image src="/img/icons/phone-call.svg" alt="" width={18} height={18} />{upperCrust.phone}</a></address><div className={styles.regularHoursHeading}><h3>Open Daily</h3><small>Holidays and exceptions may differ. Call to confirm.</small></div><dl>{upperCrustHours.map(({day,hours}) => <div key={day}><dt>{day}</dt><dd>{hours}</dd></div>)}</dl></section>
        <div className={styles.aboutAmenities}><UpperCrustAboutSection /></div>
      </div>
    </div>
    <p className={detailStyles.socialDisclosure}>Public ratings checked October 24, 2026. Counts may change; these are not live data.</p>
  </main>;
}
