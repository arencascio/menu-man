import ResetPasswordForm from "./ResetPasswordForm";
import styles from "../management.module.css";

export default function ResetPasswordPage() {
  return (
    <main className={styles.authMain}>
      <section className={styles.authCard}>
        <h1>Choose a new password</h1>
        <p className={styles.muted}>Your new password must contain at least 10 characters.</p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
