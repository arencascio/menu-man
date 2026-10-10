"use client";

import { useId } from "react";
import MenuIcon from "./MenuIcon";
import styles from "./menu-browser.module.css";

export default function MenuFavoriteButton({ name, liked, count, pending, onClick, detail = false }: {
  name: string; liked: boolean; count: number; pending: boolean; onClick: () => void; detail?: boolean;
}) {
  const countId = useId();
  return <button className={detail ? styles.detailHeartButton : styles.heartButton} type="button"
    aria-label={`${liked ? "Unlike" : "Like"} ${name}`} aria-pressed={liked} aria-describedby={countId}
    disabled={pending} onClick={onClick}>
    <MenuIcon name={liked ? "heartFilled" : "heart"} size={20} />
    {count > 0 && <span className={styles.heartCount} aria-hidden="true">{count}</span>}
    <span id={countId} className={styles.visuallyHidden}>{count} {count === 1 ? "favorite" : "favorites"}</span>
  </button>;
}
