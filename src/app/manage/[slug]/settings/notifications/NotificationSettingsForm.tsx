"use client";

import { useState } from "react";
import type { NotificationSettings } from "@/lib/notifications/contracts";
import AccessRevoked from "../../AccessRevoked";
import styles from "./notifications.module.css";

type EditableSettings = Omit<NotificationSettings, "updatedAt">;

function editableSettings(settings: NotificationSettings): EditableSettings {
  return {
    customerOrderConfirmationEmail: settings.customerOrderConfirmationEmail,
    customerReadyForPickupEmail: settings.customerReadyForPickupEmail,
    customerRefundConfirmationEmail: settings.customerRefundConfirmationEmail,
    internalNewPaidOrderEmail: settings.internalNewPaidOrderEmail,
    internalPaymentRefundExceptionEmail: settings.internalPaymentRefundExceptionEmail,
    internalEmailRecipient: settings.internalEmailRecipient,
  };
}

export default function NotificationSettingsForm({ slug, restaurantName, initialSettings }: {
  slug: string;
  restaurantName: string;
  initialSettings: NotificationSettings;
}) {
  const [settings, setSettings] = useState<EditableSettings>(() => editableSettings(initialSettings));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [accessLost, setAccessLost] = useState(false);

  function toggle(key: keyof Pick<EditableSettings,
    "customerOrderConfirmationEmail" | "customerReadyForPickupEmail" |
    "customerRefundConfirmationEmail" | "internalNewPaidOrderEmail" |
    "internalPaymentRefundExceptionEmail">) {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true); setMessage(null);
    try {
      const response = await fetch(`/api/manage/restaurants/${encodeURIComponent(slug)}/settings/notifications`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, clientActionId: crypto.randomUUID() }),
      });
      if (response.status === 401 || response.status === 403) { setAccessLost(true); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Notification settings could not be saved.");
      setSettings(editableSettings(body as NotificationSettings));
      setMessage({ tone: "success", text: "Notification settings saved." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Notification settings could not be saved." });
    } finally { setPending(false); }
  }

  if (accessLost) return <AccessRevoked restaurantName={restaurantName} slug={slug} />;
  const options: Array<{ key: Parameters<typeof toggle>[0]; title: string; description: string }> = [
    { key: "customerOrderConfirmationEmail", title: "Order confirmation email", description: "Sent after verified payment places the order." },
    { key: "customerReadyForPickupEmail", title: "Ready-for-pickup email", description: "Sent when staff marks the order ready." },
    { key: "customerRefundConfirmationEmail", title: "Refund confirmation email", description: "Sent after the provider confirms a refund." },
  ];
  const internalOptions: typeof options = [
    { key: "internalNewPaidOrderEmail", title: "New paid-order email", description: "Optional internal alert for a newly paid order." },
    { key: "internalPaymentRefundExceptionEmail", title: "Payment/refund exception email", description: "Reserved for operational exception alerts." },
  ];
  return <form className={styles.form} onSubmit={submit}>
    <section className={styles.panel}><h2>Customer emails</h2><p>These settings are independent from restaurant or POS notifications.</p>{options.map((option) => <label className={styles.option} key={option.key}><input type="checkbox" checked={settings[option.key]} onChange={() => toggle(option.key)} /><span><strong>{option.title}</strong><small>{option.description}</small></span></label>)}</section>
    <section className={styles.panel}><h2>Restaurant emails</h2><p>Disable these if another system already alerts the restaurant.</p>{internalOptions.map((option) => <label className={styles.option} key={option.key}><input type="checkbox" checked={settings[option.key]} onChange={() => toggle(option.key)} /><span><strong>{option.title}</strong><small>{option.description}</small></span></label>)}<label className={styles.emailField}>Internal recipient<input type="email" value={settings.internalEmailRecipient ?? ""} onChange={(event) => setSettings((current) => ({ ...current, internalEmailRecipient: event.target.value || null }))} placeholder="orders@example.com" /><small>Required before an enabled internal email can be queued.</small></label></section>
    {message ? <p className={message.tone === "error" ? styles.error : styles.success} role="status">{message.text}</p> : null}
    <button className={styles.save} disabled={pending}>{pending ? "Saving…" : "Save notification settings"}</button>
  </form>;
}
