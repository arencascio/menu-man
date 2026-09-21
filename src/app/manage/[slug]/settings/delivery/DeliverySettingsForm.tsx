"use client";

import type { DeliveryProvider, DeliverySettings } from "@/lib/restaurant-settings/contracts";
import AccessRevoked from "../../AccessRevoked";
import { useSettingsEditor } from "../useSettingsEditor";
import styles from "../settings.module.css";

function normalizeOrder(providers: DeliveryProvider[]) {
  return providers.map((provider, sortOrder) => ({ ...provider, sortOrder }));
}

export default function DeliverySettingsForm({
  slug,
  restaurantName,
  initialSettings,
}: {
  slug: string;
  restaurantName: string;
  initialSettings: DeliverySettings;
}) {
  const endpoint = `/api/manage/restaurants/${encodeURIComponent(slug)}/settings/delivery`;
  const editor = useSettingsEditor({ endpoint, initialValue: initialSettings });

  if (editor.accessLost) return <AccessRevoked restaurantName={restaurantName} slug={slug} />;

  const updateProvider = (id: string, change: Partial<DeliveryProvider>) => {
    editor.setValue((current) => ({
      providers: current.providers.map((provider) => provider.id === id ? { ...provider, ...change } : provider),
    }));
  };
  const addProvider = () => {
    editor.setValue((current) => current.providers.length >= 25 ? current : ({
      providers: [...current.providers, {
        id: crypto.randomUUID(),
        displayName: "",
        providerKey: null,
        destinationUrl: "",
        imageUrl: null,
        sortOrder: current.providers.length,
        isActive: true,
      }],
    }));
  };
  const removeProvider = (id: string) => {
    editor.setValue((current) => ({
      providers: normalizeOrder(current.providers.filter((provider) => provider.id !== id)),
    }));
  };
  const moveProvider = (index: number, offset: -1 | 1) => {
    editor.setValue((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.providers.length) return current;
      const providers = [...current.providers];
      [providers[index], providers[destination]] = [providers[destination], providers[index]];
      return { providers: normalizeOrder(providers) };
    });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const settings = { providers: normalizeOrder(editor.value.providers) };
    editor.setValue(settings);
    void editor.save(settings, "Delivery providers saved.");
  };

  return <form className={styles.form} onSubmit={submit}>
    <section className={styles.panel}>
      <div className={styles.sectionHeading}>
        <div>
          <h2>Delivery providers</h2>
          <p>Customers see active providers in this order. Each destination opens in a new tab.</p>
        </div>
        <button className={styles.secondaryButton} type="button" disabled={editor.value.providers.length >= 25} onClick={addProvider}>Add provider</button>
      </div>

      <div className={styles.deliveryProviders}>
        {editor.value.providers.length === 0
          ? <p className={styles.emptyNote}>No delivery providers configured.</p>
          : editor.value.providers.map((provider, index) => <div className={styles.deliveryProvider} key={provider.id}>
              <div className={styles.deliveryProviderHeading}>
                <strong>Provider {index + 1}</strong>
                <div className={styles.orderButtons} aria-label={`Display order for ${provider.displayName || `provider ${index + 1}`}`}>
                  <button className={styles.secondaryButton} type="button" disabled={index === 0} onClick={() => moveProvider(index, -1)}>Move up</button>
                  <button className={styles.secondaryButton} type="button" disabled={index === editor.value.providers.length - 1} onClick={() => moveProvider(index, 1)}>Move down</button>
                </div>
              </div>
              <div className={styles.grid}>
                <label className={styles.field}>Provider name
                  <input required maxLength={120} placeholder="DoorDash" value={provider.displayName} onChange={(event) => updateProvider(provider.id, { displayName: event.target.value })} />
                </label>
                <label className={styles.field}>Destination URL
                  <input required type="url" maxLength={2048} placeholder="https://…" value={provider.destinationUrl} onChange={(event) => updateProvider(provider.id, { destinationUrl: event.target.value })} />
                </label>
              </div>
              <div className={styles.deliveryProviderActions}>
                <label className={styles.toggle}><input type="checkbox" checked={provider.isActive} onChange={() => updateProvider(provider.id, { isActive: !provider.isActive })} /><span><strong>Enabled</strong><small>Show this provider to customers.</small></span></label>
                <button className={styles.removeButton} type="button" onClick={() => removeProvider(provider.id)}>Remove provider</button>
              </div>
            </div>)}
      </div>
    </section>
    <div className={styles.actions}>
      <button className={styles.save} disabled={editor.pending || !editor.dirty}>{editor.pending ? "Saving…" : "Save delivery providers"}</button>
      {editor.message ? <p className={editor.message.tone === "error" ? styles.error : styles.success} role="status">{editor.message.text}</p> : null}
    </div>
  </form>;
}
