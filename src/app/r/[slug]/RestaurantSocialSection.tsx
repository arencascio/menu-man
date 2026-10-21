import { useId } from "react";
import RestaurantPhotoFilmstrip from "./RestaurantPhotoFilmstrip";
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
      <RestaurantPhotoFilmstrip photos={photos} />
      {profiles.length ? <RestaurantSocialLinks profiles={profiles} /> : null}
      {previewNote ? <p className={styles.note}>{previewNote}</p> : null}
    </div>
  </section>;
}
