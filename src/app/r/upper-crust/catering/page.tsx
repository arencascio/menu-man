import type { Metadata } from "next";
import Image from "next/image";
import { upperCrust } from "@/lib/upper-crust/config";
import { upperCrustHours, upperCrustLinks, upperCrustStorefrontPhoto } from "@/lib/upper-crust/site-content";
import styles from "../upper-crust.module.css";

export const metadata: Metadata = { title: { absolute: "Catering | Upper Crust private concept" } };

export default function UpperCrustCatering() {
  const photo = upperCrustStorefrontPhoto;
  const mondayHours = upperCrustHours.find(({ day }) => day === "Monday")!.hours;
  const sundayHours = upperCrustHours.find(({ day }) => day === "Sunday")!.hours;
  return <main id="main-content" className={styles.interiorPage}>
    <header className={styles.interiorIntro}><h1>Catering</h1></header>
    <section className={styles.cateringPanel} aria-label="Catering contact"><div><h2>{upperCrust.name}</h2><p>Contact the restaurant for current options, quantities, prices, minimums, lead times and policies.</p><div className={styles.cateringActions}><a className={styles.button} href={upperCrustLinks.phone}>Call the Restaurant</a></div><dl className={styles.cateringHours}><div><dt>Monday–Saturday</dt><dd>{mondayHours}</dd></div><div><dt>Sunday</dt><dd>{sundayHours}</dd></div></dl></div><figure className={styles.cateringPhoto}><Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} unoptimized loading="eager"/><figcaption>Owner-provided photo</figcaption></figure></section>
  </main>;
}
