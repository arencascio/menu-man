import styles from "./restaurant-shell.module.css";

type RestaurantAnnouncementStripProps = {
  messages: readonly string[];
};

export default function RestaurantAnnouncementStrip({ messages }: RestaurantAnnouncementStripProps) {
  if (messages.length === 0) return null;

  return (
    <aside className={styles.announcementStrip} aria-label="Restaurant announcements">
      <ul className={styles.announcementList}>
        {messages.map((message) => (
          <li key={message} className={styles.announcementItem}>
            {message}
          </li>
        ))}
      </ul>
    </aside>
  );
}
