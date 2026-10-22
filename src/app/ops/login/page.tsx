import { notFound, redirect } from "next/navigation";
import { opsClient } from "@/lib/ops/server";
import { OpsError, opsEnabled } from "@/lib/ops/access";
import styles from "../ops.module.css";

export default async function OpsLogin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!opsEnabled(process.env)) notFound();
  let mfa = false;
  try { await opsClient(); redirect("/ops"); } catch (error) {
    if (!(error instanceof OpsError)) throw error;
    mfa = error.status === 428;
  }
  const result = (await searchParams).result;
  return <main className={styles.auth}><section className={styles.panel}>
    <p className={styles.eyebrow}>Menu Man operations</p><h1>Owner sign in</h1>
    <p>Access is limited to the explicitly provisioned owner. Restaurant accounts do not grant operations access.</p>
    {result && !mfa && <p className={styles.error} role="alert">Sign-in or access could not be verified. Check your credentials and owner provisioning.</p>}
    <form method="post" action={mfa ? "/ops/auth/verify" : "/ops/auth/sign-in"} className={styles.edit}>
      {!mfa && <><label className={styles.field}>Email<input name="email" type="email" autoComplete="username" maxLength={254} required /></label>
        <label className={styles.field}>Password<input name="password" type="password" autoComplete="current-password" maxLength={1024} required /></label></>}
      {mfa && <><p>Enter the code from your enrolled authenticator. Enrollment and recovery are managed through the trusted account provisioning process.</p>
        <label className={styles.field}>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label></>}
      <button type="submit" className={styles.primary}>{mfa ? "Verify authenticator" : "Sign in"}</button>
    </form>
    <p className={styles.muted}>No public registration or email-link sign-in is enabled here.</p>
  </section></main>;
}
