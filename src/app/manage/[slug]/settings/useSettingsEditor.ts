"use client";

import { useCallback, useEffect, useState } from "react";

export function useSettingsEditor<T>({ endpoint, initialValue }: { endpoint: string; initialValue: T }) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);

  const refresh = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (response.status === 401 || response.status === 403) { setAccessLost(true); return; }
    if (!response.ok) return;
    const next = await response.json() as T;
    setSaved(next);
    setValue((current) => JSON.stringify(current) === JSON.stringify(saved) ? next : current);
  }, [endpoint, saved]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const verify = () => { void refresh(); };
    const timer = window.setInterval(verify, 15_000);
    window.addEventListener("focus", verify);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", verify); };
  }, [refresh]);

  async function save(payload: object, successText: string) {
    setPending(true); setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, clientActionId: crypto.randomUUID() }) });
      if (response.status === 401 || response.status === 403) { setAccessLost(true); return null; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Settings could not be saved.");
      setValue(body); setSaved(body); setMessage({ tone: "success", text: successText });
      return body as T;
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Settings could not be saved." });
      return null;
    } finally { setPending(false); }
  }

  return { value, setValue, pending, message, accessLost, dirty, save };
}
