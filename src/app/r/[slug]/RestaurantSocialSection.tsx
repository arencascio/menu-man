import { useId } from "react";
import styles from "./restaurant-social-section.module.css";

import RestaurantSocialLinks, { type RestaurantSocialProfile } from "./RestaurantSocialLinks";

export default function RestaurantSocialSection({ eyebrow, title, description, photos, profiles = [], previewNote }: {
  eyebrow?: string; title: string; description?: string;
  photos: readonly { src: string; alt: string }[];
  profiles?: readonly RestaurantSocialProfile[]; previewNote?: string;
}) {
  const headingId = useId();
  return <section className={styles.section} aria-labelledby={headingId}>
    <div className={styles.inner}>
      <div className={styles.heading}>
        <div>{eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}<h2 id={headingId}>{title}</h2></div>
        <div className={styles.copy}>{description ? <p>{description}</p> : null}

        </div>
      </div>
      <div className={styles.strip} tabIndex={0} role="group" aria-label="Food photo strip. Scroll horizontally to see more photographs.">
        {photos.map((photo, index) => <figure className={styles.photo} key={`${photo.src}:${index}`}>
          {/* Approved restaurant photography; attribution is retained with the assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt={photo.alt} loading="lazy" width={480} height={600} />
          <figcaption aria-hidden="true">{String(index + 1).padStart(2, "0")} / A little more flavor</figcaption>
        </figure>)}
      </div>
      {profiles.length ? <RestaurantSocialLinks profiles={profiles} /> : null}
      {previewNote ? <p className={styles.note}>{previewNote}</p> : null}
    </div>
  </section>;
}
