import type { Metadata } from "next";
import Image from "next/image";
import { upperCrust } from "@/lib/upper-crust/config";
import { upperCrustHours, upperCrustLinks, upperCrustStorefrontPhoto } from "@/lib/upper-crust/site-content";
import styles from "../upper-crust.module.css";
import { UpperCrustAboutSection, UpperCrustLocationSection } from "../UpperCrustDetails";
import detailStyles from "../upper-crust-details.module.css";
import { isUpperCrustPreviewPresentation } from "@/lib/upper-crust/preview-presentation";

export const metadata: Metadata = { title: { absolute: "About Us | Upper Crust private concept" } };

export default function UpperCrustAbout() {
  const previewPresentation = isUpperCrustPreviewPresentation();
  return <main id="main-content" className={styles.interiorPage}>
    <header className={styles.interiorIntro}><h1>About Us</h1></header>
    {!previewPresentation && <div className={detailStyles.socialStrip} aria-label="Social and review links">
      <a href={upperCrustLinks.google} target="_blank" rel="noopener noreferrer" className={detailStyles.reviewLink}><Image src="/img/icons/Google_Symbol_0.svg" alt="Google" width={32} height={32} unoptimized/><span><strong>4.7 <span aria-hidden="true">★★★★★</span></strong><small>400 reviews</small></span></a>
      <a href={upperCrustLinks.yelp} target="_blank" rel="noopener noreferrer" className={detailStyles.reviewLink}><Image src="/img/icons/yelp%20icon.svg" alt="Yelp" width={32} height={32} unoptimized/><span><strong>4.5 <span aria-hidden="true">★★★★★</span></strong><small>881 reviews</small></span></a>
      <a href="https://www.facebook.com/profile.php?id=100063626381227" target="_blank" rel="noopener noreferrer"><Image src="/img/super-tacos/approved/social/facebook.png" alt="Facebook" width={32} height={32} unoptimized /></a>
      <a href="https://www.instagram.com/theuppercrustsandwichshoppe/?hl=en" target="_blank" rel="noopener noreferrer"><Image src="/img/super-tacos/approved/social/instagram.png" alt="Instagram" width={32} height={32} unoptimized /></a>
      <a href="https://www.tripadvisor.com/Restaurant_Review-g32978-d4433384-Reviews-The_Upper_Crust_Sandwich_Shoppe-Riverside_California.html" target="_blank" rel="noopener noreferrer"><Image className={detailStyles.tripadvisorMark} src="/img/icons/tripadvisor%20wordmark.svg" alt="Tripadvisor" width={108} height={32} unoptimized /></a>
    </div>}
    <div className={`${styles.aboutGrid} ${previewPresentation ? styles.aboutGridPreview : ""}`}>
      <div className={styles.aboutLeftColumn}>
        {previewPresentation && <section className={`${styles.neighborhoodCard} ${styles.aboutPhoto}`} aria-label="Storefront concept illustration">
          <div className={`${styles.previewStorefront} ${styles.previewStorefrontAbout}`} role="img" aria-label="Illustrated storefront concept; photography is omitted from this preview"><span className={styles.previewStorefrontAwning}/><span className={styles.previewStorefrontWindow}/><span className={styles.previewStorefrontDoor}/></div>
          <p className={styles.previewCaption}>Storefront photo area</p>
        </section>}
      {!previewPresentation && <>
        <div className={styles.aboutMap}><UpperCrustLocationSection /></div>
        <section className={`${styles.neighborhoodCard} ${styles.aboutPhoto}`} aria-label="Storefront photograph">
          <figure><Image src={upperCrustStorefrontPhoto.src} alt={upperCrustStorefrontPhoto.alt} width={upperCrustStorefrontPhoto.width} height={upperCrustStorefrontPhoto.height} unoptimized/></figure>
        </section>
      </>}
      </div>
      <div className={styles.aboutRightColumn}>
        <section className={styles.hoursCard} aria-labelledby="hours-heading"><h2 id="hours-heading">Contact</h2><address><a className={styles.addressLink} href={upperCrustLinks.directions} target="_blank" rel="noopener noreferrer nofollow"><Image src="/img/icons/map-pinned.svg" alt="" width={18} height={18} />{upperCrust.address}, {upperCrust.locality}</a><a className={styles.phoneLink} href={upperCrustLinks.phone}><Image src="/img/icons/phone-call.svg" alt="" width={18} height={18} />{upperCrust.phone}</a></address><div className={styles.regularHoursHeading}><h3>Open Daily</h3><small>Holidays and exceptions may differ. Call to confirm.</small></div><dl>{upperCrustHours.map(({day,hours}) => <div key={day}><dt>{day}</dt><dd>{hours}</dd></div>)}</dl></section>
        <div className={styles.aboutAmenities}><UpperCrustAboutSection /></div>
      </div>
    </div>
    {!previewPresentation && <p className={detailStyles.socialDisclosure}>Public ratings checked October 24, 2026. Counts may change; these are not live data.</p>}
  </main>;
}
