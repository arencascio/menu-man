import Image from "next/image";
import Link from "next/link";
import { getShowcaseHref, restaurantShowcases } from "@/lib/restaurant-showcases";
import styles from "./restaurant-showcases.module.css";
import { DemoIcon } from "./MarketingComponents";

export default function RestaurantShowcases({ compact = false, eager = false }: { compact?: boolean; eager?: boolean }) {
  return <div className={styles.section} data-compact={compact} data-single={restaurantShowcases.length === 1} data-restaurant-showcases>
    <div className={styles.grid} role="region" aria-label="Restaurant website showcase">
    {restaurantShowcases.map((showcase, index) => <article className={styles.card} key={showcase.slug} data-restaurant={showcase.slug}>
      <div className={styles.photo}>
        <Image src={showcase.image} alt={showcase.imageAlt} fill loading={eager && index === 0 ? "eager" : "lazy"}
          sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 700px) 92vw, 420px" />
        <div className={styles.imageCaption}><h3>{showcase.name}</h3><p>{showcase.eyebrow}</p></div>
      </div>
      <div className={styles.body}>
        <p>{showcase.description}</p>
        {getShowcaseHref(showcase)
          ? <Link className={styles.action} href={getShowcaseHref(showcase)!}>Explore live demo <DemoIcon /></Link>
          : <span className={styles.pending}>Live demo coming soon</span>}
      </div>
    </article>)}
    </div>
    <p className={styles.disclosure}>Restaurant showcases are fictional demonstrations.</p>
  </div>;
}
