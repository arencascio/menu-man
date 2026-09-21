"use client";

import { useState } from "react";
import type { FeaturedSettings } from "@/lib/restaurant-settings/contracts";
import { filterFeaturedItems, moveFeaturedItem, toggleFeaturedItem } from "@/lib/menu-engagement/featured-picker";
import AccessRevoked from "../../AccessRevoked";
import { useSettingsEditor } from "../useSettingsEditor";
import styles from "../settings.module.css";

export default function FeaturedSettingsForm({ slug, restaurantName, initialSettings }: { slug: string; restaurantName: string; initialSettings: FeaturedSettings }) {
  const editor = useSettingsEditor({ endpoint: `/api/manage/restaurants/${encodeURIComponent(slug)}/settings/featured`, initialValue: initialSettings });
  const [search, setSearch] = useState("");
  if (editor.accessLost) return <AccessRevoked restaurantName={restaurantName} slug={slug} />;
  const selected = editor.value.selectedItemIds;
  const names = new Map(editor.value.items.map((item) => [item.id, item.name]));
  const matches = filterFeaturedItems(editor.value.items, search);
  function toggle(id: string) {
    editor.setValue((current) => ({ ...current, selectedItemIds: toggleFeaturedItem(current.selectedItemIds, id) }));
  }
  function move(index: number, direction: -1 | 1) {
    editor.setValue((current) => {
      return { ...current, selectedItemIds: moveFeaturedItem(current.selectedItemIds, index, direction) };
    });
  }
  return <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void editor.save({ selectedItemIds: selected }, "Featured items saved."); }}>
    <section className={styles.panel}>
      <h2>Featured items</h2>
      <p>Choose up to 20 items from the published menu. They appear in this order at the top of the customer menu.</p>
      <label className={styles.field}>Search menu items
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an item by name" />
      </label>
      <p className={styles.intro}>{selected.length} selected · {matches.length} matching items</p>
      {selected.length > 0 && <div className={styles.featuredSelected} aria-label="Selected Featured items">
        {selected.map((id, index) => <div key={id} className={styles.featuredSelectedRow}>
          <span>{index + 1}. {names.get(id) ?? "Unavailable item"}</span>
          <div className={styles.orderButtons}>
            <button type="button" className={styles.secondaryButton} disabled={index === 0} onClick={() => move(index, -1)}>Up</button>
            <button type="button" className={styles.secondaryButton} disabled={index === selected.length - 1} onClick={() => move(index, 1)}>Down</button>
            <button type="button" className={styles.removeButton} onClick={() => toggle(id)}>Remove</button>
          </div>
        </div>)}
      </div>}
      <div className={styles.featuredList}>
        {matches.map((item) => <label className={styles.toggle} key={item.id}>
          <input type="checkbox" checked={selected.includes(item.id)} disabled={!selected.includes(item.id) && selected.length >= 20} onChange={() => toggle(item.id)} />
          <span>{item.name}</span>
        </label>)}
        {matches.length === 0 && <p className={styles.emptyNote}>No matching items.</p>}
      </div>
    </section>
    <div className={styles.actions}><button className={styles.save} disabled={editor.pending || !editor.dirty}>{editor.pending ? "Saving…" : "Save Featured items"}</button>
      {editor.message && <p role="status" className={editor.message.tone === "error" ? styles.error : styles.success}>{editor.message.text}</p>}
    </div>
  </form>;
}
