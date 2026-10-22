import Image from "next/image";
import styles from "./restaurant-brand-lockup.module.css";

export type RestaurantBrandLockupPresentation = {
  image: string;
  width: number;
  height: number;
};

export default function RestaurantBrandLockup({ presentation, size = "compact" }: {
  presentation: RestaurantBrandLockupPresentation;
  size?: "compact" | "footer";
}) {
  return <Image
    className={`${styles.lockup} ${size === "footer" ? styles.footer : ""}`}
    data-brand-lockup={size}
    src={presentation.image}
    width={presentation.width}
    height={presentation.height}
    style={{ aspectRatio: `${presentation.width} / ${presentation.height}` }}
    alt=""
    sizes={size === "footer" ? "(max-width: 700px) calc(100vw - 40px), 520px" : "(max-width: 568px) calc(100vw - 68px), 512px"}
    loading={size === "compact" ? "eager" : "lazy"}
  />;
}
