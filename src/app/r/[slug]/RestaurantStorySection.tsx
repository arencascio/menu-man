import Link from "next/link";
import { useId } from "react";
import styles from "./restaurant-story-section.module.css";

export type RestaurantStoryContent = {
  eyebrow?: string; title: string; paragraphs: readonly string[];
  imageUrl: string; imageAlt: string; actionLabel?: string;
};

export default function RestaurantStorySection({ content, actionHref, reverse = false }: {
  content: RestaurantStoryContent; actionHref?: string; reverse?: boolean;
}) {
  const headingId = useId();
  return <section className={styles.section} data-reverse={reverse || undefined} aria-labelledby={headingId}>
    <div className={styles.media}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={content.imageUrl} alt={content.imageAlt} loading="lazy" width={900} height={1000} />
    </div>
    <div className={styles.copy}>
      {content.eyebrow ? <p className={styles.eyebrow}>{content.eyebrow}</p> : null}
      <h2 id={headingId}>{content.title}</h2>
      {content.paragraphs.map((paragraph) => <p className={styles.paragraph} key={paragraph}>{paragraph}</p>)}
      {actionHref && content.actionLabel ? <Link className={styles.link} href={actionHref}>{content.actionLabel}<span aria-hidden="true">↗</span></Link> : null}
    </div>
  </section>;
}
