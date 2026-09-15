import Link from "next/link";
import sharedStyles from "../management.module.css";

export default function AccessRevoked({ restaurantName, signedOut = false }: { restaurantName: string; signedOut?: boolean }) {
  return (
    <section className={sharedStyles.accessRevoked} role="alert">
      <h2>{signedOut ? "Your management session ended." : `You no longer have access to ${restaurantName}.`}</h2>
      <p>Protected restaurant and customer information is no longer displayed.</p>
      <div>
        <Link className={sharedStyles.linkButton} href="/manage">Return to management</Link>
        <form action="/auth/sign-out" method="post"><button className={sharedStyles.button}>Sign out</button></form>
      </div>
    </section>
  );
}
