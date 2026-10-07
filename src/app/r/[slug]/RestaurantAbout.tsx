import styles from "./restaurant-location-page.module.css";

type RestaurantAboutProps = {
  eyebrow?: string;
  heading: string;
  description?: string;
  imageUrl?: string | null;
  restaurantName: string;
};

export default function RestaurantAbout({
  eyebrow,
  heading,
  description,
  imageUrl,
  restaurantName,
}: RestaurantAboutProps) {
  return <section className={`${styles.about} ${imageUrl ? styles.aboutWithImage : ""}`} aria-labelledby="restaurant-about-title">
    <div className={styles.aboutContent}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h1 id="restaurant-about-title">{heading}</h1>
      {description ? <p className={styles.story}>{description}</p> : null}
      <a className={styles.aboutAction} href="#restaurant-information">Hours &amp; location <span aria-hidden="true">&darr;</span></a>
    </div>
    {imageUrl ? <div className={styles.aboutMedia}>
      {/* Restaurant-owned images may be hosted externally. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={`${restaurantName} featured photograph`} />
    </div> : null}
  </section>;
}
