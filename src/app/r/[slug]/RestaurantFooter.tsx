import styles from "./restaurant-page.module.css";

type RestaurantFooterProps = {
  name: string;
  phone: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
};

export default function RestaurantFooter({ name, phone, instagramUrl, facebookUrl }: RestaurantFooterProps) {
  return (
    <footer className={styles.footer}>
      <p>{name}<br />Menu Man restaurant page</p>
      <div className={styles.socials}>
        {phone && <a href={`tel:${phone}`}>Call</a>}
        {instagramUrl && <a href={instagramUrl} target="_blank" rel="noreferrer">Instagram</a>}
        {facebookUrl && <a href={facebookUrl} target="_blank" rel="noreferrer">Facebook</a>}
      </div>
    </footer>
  );
}
