import Image from "next/image";
import Link from "next/link";
import { getShowcaseHref, restaurantShowcases } from "@/lib/restaurant-showcases";
import styles from "./restaurant-showcases.module.css";

export default function RestaurantShowcases({ compact = false }: { compact?: boolean }) {
  return <div className={styles.grid} data-compact={compact} role="region" aria-label="Restaurant showcases">
    {restaurantShowcases.map((showcase) => <article className={styles.card} key={showcase.slug} data-restaurant={showcase.slug}>
      <div className={styles.photo}>
        <Image src={showcase.image} alt={showcase.imageAlt} fill sizes={compact ? "(max-width: 900px) 100vw, 28vw" : "(max-width: 700px) 100vw, 50vw"} />
        <span>{showcase.name}</span>
      </div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>{showcase.eyebrow}</p>
        <h3>{showcase.name}</h3>
        <p>{showcase.description}</p>
        <small>{showcase.disclosure}</small>
        {getShowcaseHref(showcase)
          ? <Link className={styles.action} href={getShowcaseHref(showcase)!}>Explore Live Demo <span aria-hidden="true">↗</span></Link>
          : <span className={styles.pending}>Live demo coming soon</span>}
      </div>
    </article>)}
  </div>;
}
