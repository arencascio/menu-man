import type { OpsNotification } from "@/lib/ops/contracts";
import styles from "./ops.module.css";

export function opsDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }).format(new Date(value)) : "Not set";
}
export function NotificationState({ notification }: { notification: OpsNotification }) {
  const interrupted = notification.state === "sending" && notification.retryBlock !== "leased";
  const problem = ["failed", "retryable", "unknown"].includes(notification.state) || interrupted;
  const labels = { accepted: "Provider accepted", retryable: "Email failed · retryable", failed: "Email failed", unknown: "Outcome unknown", queued: "Queued", sending: "Sending / leased" };
  return <span className={`${styles.badge} ${problem ? styles.danger : ""}`}>{interrupted ? "Send interrupted" : labels[notification.state]}</span>;
}
export function OpsHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return <header className={styles.header}><div><a href="/ops" className={styles.eyebrow}>Menu Man operations</a><h1>{title}</h1>{children}</div>
    <form method="post" action="/ops/auth/sign-out"><button type="submit">Sign out</button></form></header>;
}
