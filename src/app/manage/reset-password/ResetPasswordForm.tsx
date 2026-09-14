"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createAdminBrowserClient } from "@/lib/supabase/admin-browser";
import styles from "../management.module.css";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (password.length < 10) {
      setError("Use at least 10 characters.");
      setPending(false);
      return;
    }
    const { error: updateError } = await createAdminBrowserClient().auth.updateUser({ password });
    if (updateError) {
      setError("This reset link is invalid or expired. Request a new one.");
      setPending(false);
      return;
    }
    router.replace("/manage");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <label className={styles.field}>
        New password
        <input className={styles.input} name="password" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
