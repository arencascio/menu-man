import Link from "next/link";
import type { ManagementCapability } from "@/lib/order-management/contracts";
import sharedStyles from "../management.module.css";

export default function ManagementNav({ slug, active, capabilities }: {
  slug: string;
  active: "orders" | "team" | "settings";
  capabilities: ManagementCapability[];
}) {
  return (
    <nav className={sharedStyles.managementNav} aria-label="Restaurant management">
      {capabilities.includes("view_orders") ? <Link className={active === "orders" ? sharedStyles.managementNavActive : sharedStyles.managementNavLink} href={`/manage/${slug}/orders`}>Orders</Link> : null}
      {capabilities.includes("manage_memberships") ? <Link className={active === "team" ? sharedStyles.managementNavActive : sharedStyles.managementNavLink} href={`/manage/${slug}/team`}>Team</Link> : null}
      {capabilities.some((capability) => capability === "manage_restaurant_settings" || capability === "manage_notifications") ? <Link className={active === "settings" ? sharedStyles.managementNavActive : sharedStyles.managementNavLink} href={`/manage/${slug}/settings`}>Settings</Link> : null}
    </nav>
  );
}
