import styles from "./upper-crust.module.css";

export default function BrickWall({ id, className = "" }: { id: string; className?: string }) {
  return <div className={`${styles.brickWall} ${className}`} data-brick-wall={id} aria-hidden="true" />;
}
