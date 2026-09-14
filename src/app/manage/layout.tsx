import type { Metadata } from "next";
import Link from "next/link";
import styles from "./management.module.css";

export const metadata: Metadata = {
  title: { default: "Menu Man Order Management", template: "%s | Menu Man Order Management" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/manage" className={styles.brand}>Menu Man Order Management</Link>
      </header>
      {children}
    </div>
  );
}
