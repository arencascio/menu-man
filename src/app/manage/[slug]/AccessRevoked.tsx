"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import sharedStyles from "../management.module.css";

export default function AccessRevoked({ restaurantName, slug, signedOut = false }: { restaurantName: string; slug?: string; signedOut?: boolean }) {
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (signedOut || !slug) return;
    let stopped = false;
    const verify = async () => {
      setChecking(true);
      try {
        const response = await fetch("/api/manage/memberships", { cache: "no-store" });
        const body = response.ok ? await response.json() as { memberships?: Array<{ restaurantSlug: string }> } : null;
        if (!stopped && body?.memberships?.some((membership) => membership.restaurantSlug === slug)) {
          window.location.reload();
        }
      } finally { if (!stopped) setChecking(false); }
    };
    const timer = window.setInterval(() => { void verify(); }, 15_000);
    window.addEventListener("focus", verify);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener("focus", verify); };
  }, [signedOut, slug]);
  return (
    <section className={sharedStyles.accessRevoked} role="alert">
      <h2>{signedOut ? "Your management session ended." : `You no longer have access to ${restaurantName}.`}</h2>
      <p>Protected restaurant and customer information is no longer displayed.</p>
      {!signedOut && slug ? <p>{checking ? "Checking for restored access…" : "Access will recover automatically if an owner reinstates you."}</p> : null}
      <div>
        <Link className={sharedStyles.linkButton} href="/manage">Return to management</Link>
        <form action="/auth/sign-out" method="post"><button className={sharedStyles.button}>Sign out</button></form>
      </div>
    </section>
  );
}
