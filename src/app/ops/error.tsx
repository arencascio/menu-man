"use client";
import styles from "./ops.module.css";
export default function OpsUnavailable() {
  return <main className={styles.main}><h1>Operations unavailable</h1><p>Lead information could not be loaded or verified. This is not an empty inbox.</p><a className={styles.button} href="/ops">Try again</a></main>;
}
