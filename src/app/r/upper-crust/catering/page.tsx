import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { upperCrust } from "@/lib/upper-crust/config";
import { upperCrustLinks, upperCrustPhotos } from "@/lib/upper-crust/site-content";
import styles from "../upper-crust.module.css";

export const metadata: Metadata = { title: { absolute: "Catering | Upper Crust private concept" } };

export default function UpperCrustCatering() {
  const photo = upperCrustPhotos[0];
  return <main id="main-content" className={styles.interiorPage}>
    <header className={styles.interiorIntro}><h1>Catering</h1></header>
    <section className={styles.cateringPanel} aria-label="Catering information"><div><h2>{upperCrust.name}</h2><p>Catering is listed in the Riverside Downtown Partnership directory. Contact the restaurant for current options, quantities, prices, minimums, lead times and policies.</p><div className={styles.heroActions}><a className={styles.button} href={upperCrustLinks.phone}>Call {upperCrust.phone}</a><Link className={styles.textLink} href="/r/upper-crust/menu">View Menu →</Link></div><small>Calling contacts the actual restaurant. This concept does not accept catering requests or orders.</small><a className={styles.factSource} href={upperCrustLinks.directory} target="_blank" rel="noopener noreferrer nofollow">Riverside Downtown Partnership ↗</a></div><figure className={styles.cateringPhoto}><Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} unoptimized loading="eager"/><figcaption>Owner-provided photo</figcaption></figure></section>
    <div className={styles.cateringFootnote}><Link href="/r/upper-crust/about">Hours, Contact & Directions →</Link><p>Informational only. No quote, booking, catering cart or live order is created.</p></div>
  </main>;
}
