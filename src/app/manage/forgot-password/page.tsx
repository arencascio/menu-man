import PasswordResetRequest from "./PasswordResetRequest";
import styles from "../management.module.css";

export default function ForgotPasswordPage() {
  return (
    <main className={styles.authMain}>
      <section className={styles.authCard}>
        <h1>Reset password</h1>
        <p className={styles.muted}>We’ll email a secure link to reset your restaurant-management password.</p>
        <PasswordResetRequest />
      </section>
    </main>
  );
}
