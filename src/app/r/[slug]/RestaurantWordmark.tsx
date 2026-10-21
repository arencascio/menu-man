import styles from "./restaurant-wordmark.module.css";

export default function RestaurantWordmark({ name, fontClassName, className }: {
  name: string;
  fontClassName?: string;
  className?: string;
}) {
  return <span className={[fontClassName ? styles.custom : undefined, fontClassName, className].filter(Boolean).join(" ")}
    data-wordmark-font={fontClassName ? "custom" : undefined}>{name}</span>;
}
