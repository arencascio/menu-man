import Image from "next/image";
import styles from "./menu-browser.module.css";

type MenuIconName = "chevronLeft" | "chevronRight" | "close" | "heart" | "heartFilled" | "minus" | "plus" | "search" | "share" | "cart" | "sections";

const iconFiles: Record<Exclude<MenuIconName, "heart" | "heartFilled">, string> = {
  chevronLeft: "chevron-right",
  chevronRight: "chevron-right",
  close: "x",
  minus: "minus",
  plus: "plus",
  search: "search",
  share: "share-2",
  cart: "shopping-cart",
  sections: "menu-all-sections-button",
};

export default function MenuIcon({ name, size = 18 }: { name: MenuIconName; size?: number }) {
  const style = { width: size, height: size };
  if (name === "heart" || name === "heartFilled") {
    return (
      <svg className={styles.menuIcon} style={style} viewBox="0 0 24 24" fill={name === "heartFilled" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
      </svg>
    );
  }
  const flipped = name === "chevronLeft";
  return <Image className={`${styles.menuIcon} ${flipped ? styles.menuIconFlipped : ""}`} style={style} src={`/img/icons/${iconFiles[name]}.svg`} width={size} height={size} unoptimized alt="" aria-hidden="true" />;
}
