import styles from "./restaurant-wordmark.module.css";

export default function RestaurantWordmark({ name, fontClassName, fontFamily, className }: {
  name: string;
  fontClassName?: string;
  fontFamily?: string;
  className?: string;
}) {
  return <span className={[fontClassName ? styles.custom : undefined, fontClassName, className].filter(Boolean).join(" ")}
    style={fontFamily ? { fontFamily } : undefined} data-wordmark-font={fontClassName ? "custom" : undefined}>{name}</span>;
}
