"use client";

import type { RestaurantSettings } from "@/lib/restaurant-settings/contracts";
import AccessRevoked from "../../AccessRevoked";
import { useSettingsEditor } from "../useSettingsEditor";
import styles from "../settings.module.css";

export default function RestaurantSettingsForm({ slug, restaurantName, initialSettings }: { slug: string; restaurantName: string; initialSettings: RestaurantSettings }) {
  const endpoint = `/api/manage/restaurants/${encodeURIComponent(slug)}/settings/restaurant`;
  const editor = useSettingsEditor({ endpoint, initialValue: initialSettings });
  if (editor.accessLost) return <AccessRevoked restaurantName={restaurantName} slug={slug} />;
  const set = (key: keyof RestaurantSettings, value: string) => editor.setValue((current) => ({ ...current, [key]: value }));
  return <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void editor.save(editor.value, "Restaurant settings saved."); }}>
    <section className={styles.panel}><h2>Restaurant profile</h2><p>These details appear on the customer-facing restaurant page after saving.</p>
      <div className={styles.grid}>
        <label className={styles.field}>Restaurant name<input required maxLength={120} value={editor.value.name} onChange={(event) => set("name", event.target.value)} /></label>
        <label className={styles.field}>Phone<input maxLength={40} value={editor.value.phone ?? ""} onChange={(event) => set("phone", event.target.value)} /></label>
        <label className={`${styles.field} ${styles.full}`}>Tagline<input maxLength={180} value={editor.value.tagline ?? ""} onChange={(event) => set("tagline", event.target.value)} /></label>
        <label className={`${styles.field} ${styles.full}`}>Description<textarea maxLength={2000} value={editor.value.description ?? ""} onChange={(event) => set("description", event.target.value)} /></label>
      </div>
    </section>
    <section className={styles.panel}><h2>Location</h2><p>Used for restaurant contact details and pickup directions.</p><div className={styles.grid}>
      <label className={`${styles.field} ${styles.full}`}>Address line 1<input maxLength={200} value={editor.value.addressLine1 ?? ""} onChange={(event) => set("addressLine1", event.target.value)} /></label>
      <label className={styles.field}>City<input maxLength={100} value={editor.value.city ?? ""} onChange={(event) => set("city", event.target.value)} /></label>
      <label className={styles.field}>State<input maxLength={100} value={editor.value.state ?? ""} onChange={(event) => set("state", event.target.value)} /></label>
      <label className={styles.field}>Postal code<input maxLength={20} value={editor.value.postalCode ?? ""} onChange={(event) => set("postalCode", event.target.value)} /></label>
      <label className={`${styles.field} ${styles.full}`}>Google Maps / directions URL<input type="url" placeholder="https://…" value={editor.value.googleMapsUrl ?? ""} onChange={(event) => set("googleMapsUrl", event.target.value)} /></label>
    </div></section>
    <section className={styles.panel}><h2>Social links</h2><div className={styles.grid}>
      <label className={styles.field}>Instagram URL<input type="url" placeholder="https://…" value={editor.value.instagramUrl ?? ""} onChange={(event) => set("instagramUrl", event.target.value)} /></label>
      <label className={styles.field}>Facebook URL<input type="url" placeholder="https://…" value={editor.value.facebookUrl ?? ""} onChange={(event) => set("facebookUrl", event.target.value)} /></label>
    </div></section>
    <div className={styles.actions}><button className={styles.save} disabled={editor.pending || !editor.dirty}>{editor.pending ? "Saving…" : "Save restaurant settings"}</button>{editor.message ? <p className={editor.message.tone === "error" ? styles.error : styles.success} role="status">{editor.message.text}</p> : null}</div>
  </form>;
}
