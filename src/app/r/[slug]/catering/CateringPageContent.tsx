import type { CateringSettings } from "@/lib/catering/contracts";
import CateringInquiryForm from "./CateringInquiryForm";
import styles from "./catering.module.css";

export default function CateringPageContent({ settings, slug, restaurantId, timezone }: { settings: CateringSettings; slug: string; restaurantId: string; timezone: string }) {
  return <main className={styles.main}>
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>Plan your event</p><h1>{settings.heading}</h1><p className={styles.description}>{settings.description}</p>
        <a className={styles.button} href="#catering-inquiry">{settings.ctaLabel}</a>
      </div>
      {/* Existing media URLs are tenant configuration; no image uploads here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {settings.imageUrl ? <img className={styles.image} src={settings.imageUrl} alt={settings.imageAlt} width={960} height={640} /> : null}
    </header>
    <CateringInquiryForm slug={slug} restaurantId={restaurantId} timezone={timezone} ctaLabel={settings.ctaLabel} />
  </main>;
}
