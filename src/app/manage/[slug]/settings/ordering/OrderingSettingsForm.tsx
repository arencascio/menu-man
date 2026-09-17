"use client";

import { useState } from "react";
import type { OrderingSettings } from "@/lib/restaurant-settings/contracts";
import AccessRevoked from "../../AccessRevoked";
import { useSettingsEditor } from "../useSettingsEditor";
import styles from "../settings.module.css";

export default function OrderingSettingsForm({ slug, restaurantName, initialSettings }: { slug: string; restaurantName: string; initialSettings: OrderingSettings }) {
  const endpoint = `/api/manage/restaurants/${encodeURIComponent(slug)}/settings/ordering`;
  const editor = useSettingsEditor({ endpoint, initialValue: initialSettings });
  const [tipDollars, setTipDollars] = useState(() => (initialSettings.customTipAdditiveCapCents / 100).toFixed(2));
  if (editor.accessLost) return <AccessRevoked restaurantName={restaurantName} slug={slug} />;
  const toggle = (key: keyof OrderingSettings) => editor.setValue((current) => ({ ...current, [key]: !current[key] }));
  const number = (key: keyof OrderingSettings, value: string) => editor.setValue((current) => ({ ...current, [key]: Number(value) }));
  const submit = (event: React.FormEvent) => { event.preventDefault(); void editor.save(editor.value, "Ordering settings saved."); };
  return <form className={styles.form} onSubmit={submit}>
    <section className={styles.panel}><h2>Pickup modes</h2><p>Disabling pickup makes all ordering unavailable. At least one mode must be enabled for customers to choose pickup.</p>
      <label className={styles.toggle}><input type="checkbox" checked={editor.value.pickupEnabled} onChange={() => { const enabled = !editor.value.pickupEnabled; editor.setValue((current) => ({ ...current, pickupEnabled: enabled, ...(!enabled ? { asapEnabled: false, scheduledPickupEnabled: false } : {}) })); }} /><span><strong>Pickup enabled</strong><small>Master switch for customer ordering.</small></span></label>
      <label className={styles.toggle}><input type="checkbox" disabled={!editor.value.pickupEnabled} checked={editor.value.asapEnabled} onChange={() => toggle("asapEnabled")} /><span><strong>ASAP pickup</strong><small>Offer the next eligible pickup time.</small></span></label>
      <label className={styles.toggle}><input type="checkbox" disabled={!editor.value.pickupEnabled} checked={editor.value.scheduledPickupEnabled} onChange={() => toggle("scheduledPickupEnabled")} /><span><strong>Scheduled pickup</strong><small>Let customers choose from generated time slots.</small></span></label>
    </section>
    <section className={styles.panel}><h2>Pickup timing</h2><div className={styles.grid}>
      <label className={styles.field}>Lead time (minutes)<input type="number" min="0" max="1440" required value={editor.value.pickupLeadTimeMinutes} onChange={(e) => number("pickupLeadTimeMinutes", e.target.value)} /></label>
      <label className={styles.field}>Slot interval (minutes)<input type="number" min="5" max="1440" required value={editor.value.pickupSlotIntervalMinutes} onChange={(e) => number("pickupSlotIntervalMinutes", e.target.value)} /><small>5–1,440 minutes.</small></label>
      <label className={styles.field}>Advance order days<input type="number" min="0" max="30" required value={editor.value.advanceOrderDays} onChange={(e) => number("advanceOrderDays", e.target.value)} /><small>0–30 days beyond today.</small></label>
    </div></section>
    <section className={styles.panel}><h2>Customer details</h2><p>Required fields remain enforced by authoritative checkout validation.</p>
      {([['customerNameRequired','Customer name'],['customerEmailRequired','Customer email'],['customerPhoneRequired','Customer phone']] as const).map(([key,label]) => <label className={styles.toggle} key={key}><input type="checkbox" checked={editor.value[key]} onChange={() => toggle(key)} /><span><strong>{label} required</strong></span></label>)}
    </section>
    <section className={styles.panel}><h2>Tips and refunds</h2><div className={styles.grid}>
      <label className={styles.field}>Custom tip additive cap (dollars)<input type="number" min="0" max="21474836.47" step="0.01" required value={tipDollars} onChange={(e) => { setTipDollars(e.target.value); number("customTipAdditiveCapCents", Math.round(Number(e.target.value) * 100).toString()); }} /><small>This amount is added to the authoritative subtotal when calculating the maximum custom tip.</small></label>
      <label className={styles.field}>Refund eligibility window (days)<input type="number" min="0" max="365" required value={editor.value.refundWindowDays} onChange={(e) => number("refundWindowDays", e.target.value)} /><small>0–365 days after order placement.</small></label>
    </div></section>
    <div className={styles.actions}><button className={styles.save} disabled={editor.pending || !editor.dirty}>{editor.pending ? "Saving…" : "Save ordering settings"}</button>{editor.message ? <p className={editor.message.tone === "error" ? styles.error : styles.success} role="status">{editor.message.text}</p> : null}</div>
  </form>;
}
