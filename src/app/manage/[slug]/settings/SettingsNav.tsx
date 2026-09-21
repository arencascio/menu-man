"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ManagementCapability } from "@/lib/order-management/contracts";
import styles from "./settings.module.css";

export default function SettingsNav({ slug, capabilities }: { slug: string; capabilities: ManagementCapability[] }) {
  const general = capabilities.includes("manage_restaurant_settings");
  const pathname = usePathname();
  const item = (href: string, label: string) => <Link className={pathname === href ? styles.tabActive : undefined} href={href}>{label}</Link>;
  return <nav className={styles.tabs} aria-label="Settings sections">
    {general ? item(`/manage/${slug}/settings/restaurant`, "Restaurant") : null}
    {general ? item(`/manage/${slug}/settings/ordering`, "Ordering") : null}
    {general ? item(`/manage/${slug}/settings/delivery`, "Delivery") : null}
    {general ? item(`/manage/${slug}/settings/featured`, "Featured") : null}
    {general ? item(`/manage/${slug}/settings/hours`, "Hours") : null}
    {capabilities.includes("manage_notifications") ? item(`/manage/${slug}/settings/notifications`, "Notifications") : null}
  </nav>;
}
