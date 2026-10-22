import type { Metadata } from "next";
import styles from "./ops.module.css";

export const metadata: Metadata = {
  title: "Operations", description: "Private Menu Man operations.",
  robots: { index: false, follow: false }, referrer: "same-origin",
};
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.root}>{children}</div>;
}
