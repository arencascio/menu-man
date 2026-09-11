import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Menu Man",
  description: "Quick links for Menu Man development and testing.",
};

const utilityLinks = [
  {
    href: "/sitemap.xml",
    title: "Sitemap",
    description: "Inspect the generated restaurant sitemap.",
  },
  {
    href: "/robots.txt",
    title: "Robots",
    description: "Check the current crawler rules.",
  },
];

function formatEnvironment(environment: string | undefined) {
  if (!environment) {
    return "Local";
  }

  return environment.charAt(0).toUpperCase() + environment.slice(1);
}

export default function Home() {
  const deployment = {
    environment: formatEnvironment(process.env.VERCEL_ENV),
    branch: process.env.VERCEL_GIT_COMMIT_REF || "local",
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Menu Man</p>
          <h1>Project shortcuts</h1>
          <p className={styles.intro}>
            Open the current restaurant experience and a few useful app routes.
          </p>
          <p className={styles.environmentNote}>
            These links stay on the environment you are viewing, whether local,
            preview, or production.
          </p>
        </header>

        <section
          aria-labelledby="deployment-heading"
          className={styles.deployment}
        >
          <h2 id="deployment-heading" className={styles.sectionTitle}>
            Deployment
          </h2>
          <dl className={styles.deploymentGrid}>
            <div>
              <dt>Environment</dt>
              <dd>{deployment.environment}</dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>{deployment.branch}</dd>
            </div>
            <div>
              <dt>Build</dt>
              <dd>{deployment.build}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="restaurants-heading">
          <h2 id="restaurants-heading" className={styles.sectionTitle}>
            Restaurants
          </h2>
          <Link className={`${styles.card} ${styles.primaryCard}`} href="/r/armandos">
            <span className={styles.cardLabel}>Restaurant</span>
            <span className={styles.cardTitle}>Armando&apos;s</span>
            <span className={styles.cardDescription}>
              Browse the menu and ordering flow.
            </span>
            <span className={styles.cardAction}>Open restaurant →</span>
          </Link>
        </section>

        <section aria-labelledby="utilities-heading">
          <h2 id="utilities-heading" className={styles.sectionTitle}>
            Utilities
          </h2>
          <div className={styles.utilityGrid}>
            {utilityLinks.map((link) => (
              <Link className={styles.card} href={link.href} key={link.href}>
                <span className={styles.cardTitle}>{link.title}</span>
                <span className={styles.cardDescription}>{link.description}</span>
                <span className={styles.cardAction}>Open →</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
