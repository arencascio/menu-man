import styles from "./restaurant-social-links.module.css";

export type RestaurantSocialProfile = { platform: "instagram" | "tiktok" | "facebook"; label: string; href?: string; iconUrl?: string | null };

function SocialIcon({ platform }: { platform: RestaurantSocialProfile["platform"] }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    {platform === "instagram" ? <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".7" fill="currentColor" stroke="none" /></> : platform === "tiktok" ? <path d="M14 3v12a4 4 0 1 1-4-4M14 3c1 4 3 5 7 5" /> : <path d="M14 21V13h3l.5-4H14V7c0-1.2.4-2 2-2h2V2.5A22 22 0 0 0 15 2c-3 0-5 1.8-5 5v2H7v4h3v8" />}
  </svg>;
}

export default function RestaurantSocialLinks({ profiles }: { profiles: readonly RestaurantSocialProfile[] }) {
  return <div className={styles.strip} role="group" aria-label="Social media profiles">
    {profiles.map((profile) => {
      const content = <>{profile.iconUrl ? (
        // Owner-supplied brand artwork is decorative; the visible label names the platform.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.iconUrl} alt="" width={24} height={24} />
      ) : profile.iconUrl === null ? null : <SocialIcon platform={profile.platform} />}<span>{profile.label}<small>{profile.href ? "Follow along" : "Profile preview"}</small></span>{profile.href ? <span aria-hidden="true">&#8599;</span> : null}</>;
      return profile.href ? <a className={styles.profile} href={profile.href} key={profile.platform} target="_blank" rel="noreferrer">{content}</a> : <span className={styles.profile} data-illustrative="true" key={profile.platform} aria-label={`${profile.label}: illustrative, profile not connected`}>{content}</span>;
    })}
  </div>;
}
