import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Diagnostics | Menu Man",
  description: "Menu Man deployment diagnostics and project shortcuts.",
  robots: { index: false, follow: false },
};

function formatEnvironment(environment: string | undefined) {
  if (!environment) return "Local";
  return environment.charAt(0).toUpperCase() + environment.slice(1);
}

export default function DiagnosticsPage() {
  const deployment = {
    environment: formatEnvironment(process.env.VERCEL_ENV),
    branch: process.env.VERCEL_GIT_COMMIT_REF || "local",
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header>
          <p className={styles.eyebrow}>Menu Man</p>
          <h1>Diagnostics</h1>
          <p className={styles.intro}>Deployment details and useful project routes for this environment.</p>
        </header>
        <section aria-labelledby="deployment-heading" className={styles.panel}>
          <h2 id="deployment-heading">Deployment</h2>
          <dl className={styles.deploymentGrid}>
            <div><dt>Environment</dt><dd>{deployment.environment}</dd></div>
            <div><dt>Branch</dt><dd>{deployment.branch}</dd></div>
            <div><dt>Build</dt><dd>{deployment.build}</dd></div>
          </dl>
        </section>
        <section aria-labelledby="routes-heading">
          <h2 id="routes-heading">Project routes</h2>
          <div className={styles.linkGrid}>
            <Link href="/r/armandos"><strong>Armando&apos;s</strong><span>Restaurant menu and ordering flow →</span></Link>
            <Link href="/manage/armandos/orders"><strong>Armando&apos;s Order Management</strong><span>Open the internal order queue →</span></Link>
            <Link href="/sitemap.xml"><strong>Sitemap</strong><span>Inspect generated restaurant routes →</span></Link>
            <Link href="/robots.txt"><strong>Robots</strong><span>Check the current crawler rules →</span></Link>
          </div>
        </section>
        <Link className={styles.homeLink} href="/">← Back to the Menu Man website</Link>
      </div>
    </main>
  );
}
