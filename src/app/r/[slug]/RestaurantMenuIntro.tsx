import styles from "./restaurant-menu-intro.module.css";

export type RestaurantMenuQuicklink = {
  href: string;
  label: string;
};

type RestaurantMenuIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  quicklinks: readonly RestaurantMenuQuicklink[];
};

export default function RestaurantMenuIntro({
  eyebrow,
  title,
  description,
  quicklinks,
}: RestaurantMenuIntroProps) {
  return (
    <section
      id="restaurant-menu"
      className={styles.section}
      aria-labelledby="restaurant-menu-intro-title"
    >
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="restaurant-menu-intro-title">{title}</h2>
          <p className={styles.description}>{description}</p>
        </div>

        {quicklinks.length > 0 ? (
          <nav className={styles.quicklinks} aria-label="Popular menu categories">
            <p>Jump to a favorite</p>
            <div className={styles.quicklinkScroller}>
              {quicklinks.map((quicklink) => (
                <a href={quicklink.href} key={quicklink.href}>
                  <span>{quicklink.label}</span>
                  <span aria-hidden="true">&#8595;</span>
                </a>
              ))}
            </div>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
