"use client";

import type { HoursSettings } from "@/lib/restaurant-settings/contracts";
import AccessRevoked from "../../AccessRevoked";
import { useSettingsEditor } from "../useSettingsEditor";
import styles from "../settings.module.css";

const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function HoursSettingsForm({ slug, restaurantName, initialSettings }: { slug: string; restaurantName: string; initialSettings: HoursSettings }) {
  const endpoint = `/api/manage/restaurants/${encodeURIComponent(slug)}/settings/hours`;
  const editor = useSettingsEditor({ endpoint, initialValue: initialSettings });
  if (editor.accessLost) return <AccessRevoked restaurantName={restaurantName} slug={slug} />;
  const update = (index: number, change: Partial<HoursSettings["days"][number]>) => editor.setValue((current) => ({ ...current, days: current.days.map((day, dayIndex) => dayIndex === index ? { ...day, ...change } : day) }));
  const updateSpecial = (index: number, change: Partial<HoursSettings["specialDates"][number]>) => editor.setValue((current) => ({ ...current, specialDates: current.specialDates.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...change } : entry) }));
  const addSpecial = () => editor.setValue((current) => ({ ...current, specialDates: [...current.specialDates, { id: crypto.randomUUID(), serviceDate: "", label: null, isClosed: true, openTime: null, closeTime: null }] }));
  const removeSpecial = (index: number) => editor.setValue((current) => ({ ...current, specialDates: current.specialDates.filter((_, entryIndex) => entryIndex !== index) }));
  return <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void editor.save({ days: editor.value.days, specialDates: editor.value.specialDates }, "Business hours saved."); }}>
    {editor.value.hadMultipleIntervals ? <p className={styles.warning}>This restaurant currently has multiple service windows on at least one day. This v1 editor supports one window per day; saving will replace split shifts with the single windows shown below.</p> : null}
    <section className={styles.panel}><h2>Weekly business hours</h2><p>Times use the restaurant timezone: <strong>{editor.value.timezone}</strong>. Overnight ranges are not supported in v1.</p><div className={styles.hours}>
      {editor.value.days.map((day, index) => <div className={styles.day} key={day.dayOfWeek}>
        <span className={styles.dayName}>{names[day.dayOfWeek]}</span>
        <label className={styles.field}>Status<select value={day.isClosed ? "closed" : "open"} onChange={(event) => update(index, { isClosed: event.target.value === "closed" })}><option value="open">Open</option><option value="closed">Closed</option></select></label>
        <label className={styles.field}>Opening<input type="time" required={!day.isClosed} disabled={day.isClosed} value={day.openTime ?? ""} onChange={(event) => update(index, { openTime: event.target.value || null })} /></label>
        <label className={styles.field}>Closing<input type="time" required={!day.isClosed} disabled={day.isClosed} value={day.closeTime ?? ""} onChange={(event) => update(index, { closeTime: event.target.value || null })} /></label>
      </div>)}
    </div></section>
    <section className={styles.panel}><div className={styles.sectionHeading}><div><h2>Special hours</h2><p>Date-specific hours override the normal weekly schedule. Recurring holidays, overnight hours, and split shifts are not supported in v1.</p></div><button className={styles.secondaryButton} type="button" onClick={addSpecial}>Add special date</button></div>
      <div className={styles.specialHours}>
        {editor.value.specialDates.length === 0 ? <p className={styles.emptyNote}>No special dates configured.</p> : editor.value.specialDates.map((entry, index) => <div className={styles.specialDay} key={entry.id}>
          <label className={styles.field}>Date<input type="date" required value={entry.serviceDate} onChange={(event) => updateSpecial(index, { serviceDate: event.target.value })} /></label>
          <label className={styles.field}>Internal label <small>Optional</small><input maxLength={100} placeholder="Christmas Day" value={entry.label ?? ""} onChange={(event) => updateSpecial(index, { label: event.target.value || null })} /></label>
          <label className={styles.field}>Status<select value={entry.isClosed ? "closed" : "open"} onChange={(event) => updateSpecial(index, { isClosed: event.target.value === "closed" })}><option value="closed">Closed all day</option><option value="open">Custom hours</option></select></label>
          <label className={styles.field}>Opening<input type="time" required={!entry.isClosed} disabled={entry.isClosed} value={entry.openTime ?? ""} onChange={(event) => updateSpecial(index, { openTime: event.target.value || null })} /></label>
          <label className={styles.field}>Closing<input type="time" required={!entry.isClosed} disabled={entry.isClosed} value={entry.closeTime ?? ""} onChange={(event) => updateSpecial(index, { closeTime: event.target.value || null })} /></label>
          <button className={styles.removeButton} type="button" onClick={() => removeSpecial(index)} aria-label={`Delete special hours for ${entry.serviceDate || "new date"}`}>Delete</button>
        </div>)}
      </div>
    </section>
    <div className={styles.actions}><button className={styles.save} disabled={editor.pending || !editor.dirty}>{editor.pending ? "Saving…" : "Save business hours"}</button>{editor.message ? <p className={editor.message.tone === "error" ? styles.error : styles.success} role="status">{editor.message.text}</p> : null}</div>
  </form>;
}
