"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createAdminBrowserClient } from "@/lib/supabase/admin-browser";
import styles from "../management.module.css";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const supabase = createAdminBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    if (signInError) {
      setError("Email or password was not recognized.");
      setPending(false);
      return;
    }
    const next = searchParams.get("next");
    router.replace(next?.startsWith("/manage") ? next : "/manage");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <label className={styles.field}>
        Email
        <input className={styles.input} name="email" type="email" autoComplete="email" required />
      </label>
      <label className={styles.field}>
        Password
        <input className={styles.input} name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <Link className={styles.textLink} href="/manage/forgot-password">Forgot your password?</Link>
    </form>
  );
}
