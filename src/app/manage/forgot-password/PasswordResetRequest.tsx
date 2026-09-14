"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createAdminBrowserClient } from "@/lib/supabase/admin-browser";
import styles from "../management.module.css";

export default function PasswordResetRequest() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    await createAdminBrowserClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/manage/reset-password`,
    });
    setSent(true);
    setPending(false);
  }

  return (
    <>
      {sent ? <p className={styles.success}>If that email has access, a password-reset link is on its way.</p> : null}
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          Email
          <input className={styles.input} name="email" type="email" autoComplete="email" required />
        </label>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
        <Link className={styles.textLink} href="/manage/login">Back to sign in</Link>
      </form>
    </>
  );
}
