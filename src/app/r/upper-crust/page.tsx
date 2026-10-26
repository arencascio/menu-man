import Image from "next/image";
import Link from "next/link";
import { upperCrustAwningCarouselPhotos, upperCrustPhotos, upperCrustStorefrontPhoto } from "@/lib/upper-crust/site-content";
import { upperCrust } from "@/lib/upper-crust/config";
import RestaurantPhotoFilmstrip from "../[slug]/RestaurantPhotoFilmstrip";
import ShopWindow from "./ShopWindow";
import BrickWall from "./BrickWall";
import styles from "./upper-crust.module.css";
import UpperCrustDetails from "./UpperCrustDetails";

export default function UpperCrustHome() {
  const communityPhotos = [...upperCrustPhotos, upperCrustStorefrontPhoto].map((photo) => ({
    src: photo.src, alt: photo.alt, caption: null, itemName: photo.caption,
  }));
  return <main id="main-content" className={styles.homeMain}>
    <section className={styles.storefrontHero} aria-labelledby="welcome-heading">
      <div className={styles.heroLeft}>
        <div className={styles.welcomePanel}>
          <h1 id="welcome-heading">Serving sandwiches to Downtown Riverside for over 20 years</h1>
          <div className={styles.todayHours}><span>Monday–Saturday</span><strong>10 AM–5 PM</strong><span>Sunday</span><strong>11 AM–4 PM</strong></div>
          <div className={styles.storefrontFrame}><Image className={styles.storefrontImage} src="/img/sandwich-shop/storefront-crop.png" alt="The Upper Crust storefront" width={700} height={700} unoptimized priority/><div className={styles.heroActions}><Link className={styles.button} href="/r/upper-crust/menu"><Image src="/img/icons/utensils.svg" alt="" width={18} height={18} unoptimized/>View Menu</Link><a className={styles.textLink} href="https://maps.google.com/?q=3573+Main+Street,+Riverside,+CA+92501" target="_blank" rel="noopener noreferrer nofollow"><Image src="/img/icons/map-pin.svg" alt="" width={18} height={18} unoptimized/>{upperCrust.address}, Riverside</a></div></div>
        </div>
      </div>
      <ShopWindow photos={upperCrustAwningCarouselPhotos}/>
    </section>
    <BrickWall id="hero-transition" className={styles.brickTransition}/>
    <nav className={styles.ribbon} aria-label="Explore menu sections">
      <Link href="/r/upper-crust/menu#restaurant-menu-section-uc-specialty">Specialty sandwiches</Link><i aria-hidden="true">&#10035;</i><Link href="/r/upper-crust/menu#restaurant-menu-section-uc-custom">Custom sandwiches</Link><i aria-hidden="true">&#10035;</i><Link href="/r/upper-crust/menu#restaurant-menu-section-uc-soups">Soups & salads</Link><i aria-hidden="true">&#10035;</i><Link href="/r/upper-crust/menu#restaurant-menu-section-uc-extras">Sides & sweets</Link>
    </nav>
      <section className={styles.community} aria-label="Photos">
      <RestaurantPhotoFilmstrip photos={communityPhotos} controlsLabel={null} controlsPlacement="sides" svgControls enableViewer viewportLabel="Restaurant photos. Drag or use left and right arrow keys to browse."/>
    </section>
    <UpperCrustDetails />
  </main>;
}
