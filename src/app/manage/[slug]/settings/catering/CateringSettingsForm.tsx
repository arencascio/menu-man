"use client";

import type { CateringSettings } from "@/lib/catering/contracts";
import { useSettingsEditor } from "../useSettingsEditor";
import AccessRevoked from "../../AccessRevoked";
import styles from "../settings.module.css";

export default function CateringSettingsForm({ slug, restaurantName, initialSettings }: { slug: string; restaurantName: string; initialSettings: CateringSettings }) {
  const editor = useSettingsEditor({ endpoint: `/api/manage/restaurants/${encodeURIComponent(slug)}/settings/catering`, initialValue: initialSettings });
  if (editor.accessLost) return <AccessRevoked slug={slug} restaurantName={restaurantName} />;
  return <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void editor.save(editor.value, "Catering settings saved."); }}>
    <section className={styles.panel}><h2>Catering inquiries</h2><p>Enable only after reviewing your restaurant&apos;s catering content. Disabling hides the page and navigation and stops new requests. Existing leads remain available.</p>
      <fieldset disabled={editor.pending} className={styles.grid}>
        <label className={styles.full}><input type="checkbox" checked={editor.value.enabled} onChange={(event) => editor.setValue((value) => ({ ...value, enabled: event.target.checked }))} /> Enable catering inquiries</label>
        {([ ["heading", "Page heading", 120], ["description", "Description", 2000], ["ctaLabel", "Inquiry button label", 60], ["imageUrl", "Image URL or local media path (optional)", 2048], ["imageAlt", "Image description", 200] ] as const).map(([name, label, max]) => <label key={name} className={`${styles.field} ${styles.full}`}>
          {label}{name === "description" ? <textarea value={editor.value[name]} maxLength={max} rows={4} onChange={(event) => editor.setValue((value) => ({ ...value, [name]: event.target.value }))} />
            : <input required={["heading", "ctaLabel"].includes(name) || name === "imageAlt" && Boolean(editor.value.imageUrl)} value={editor.value[name]} maxLength={max} onChange={(event) => editor.setValue((value) => ({ ...value, [name]: event.target.value }))} />}
        </label>)}
        <label className={styles.full}><input type="checkbox" checked={editor.value.notifyOwner} onChange={(event) => editor.setValue((value) => ({ ...value, notifyOwner: event.target.checked }))} /> Attempt an owner email notification for new requests</label>
      </fieldset>
      <p>Emails use the internal recipient configured in Notifications and the existing email provider. Delivery is not guaranteed. The catering inbox always holds received requests; each lead shows its notification status.</p>
    </section>
    <div className={styles.actions}><button className={styles.save} disabled={editor.pending || !editor.dirty}>{editor.pending ? "Saving…" : "Save catering settings"}</button>
      {editor.message ? <p className={editor.message.tone === "error" ? styles.error : styles.success} role="status">{editor.message.text}</p> : null}</div>
  </form>;
}
