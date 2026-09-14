import { Suspense } from "react";
import LoginForm from "./LoginForm";
import styles from "../management.module.css";

export default function ManagementLoginPage() {
  return (
    <main className={styles.authMain}>
      <section className={styles.authCard}>
        <h1>Restaurant sign in</h1>
        <p className={styles.muted}>Use the email address invited by your restaurant owner. Public sign-up is not available.</p>
        <Suspense><LoginForm /></Suspense>
      </section>
    </main>
  );
}
