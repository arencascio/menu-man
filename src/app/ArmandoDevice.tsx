import styles from "./page.module.css";

export type ArmandoDeviceMode = "home" | "menu" | "order" | "details";

export default function ArmandoDevice({ mode = "home" }: { mode?: ArmandoDeviceMode }) {
  return (
    <div className={styles.deviceStage}>
      <div className={styles.browserDevice}>
        <div className={styles.browserTop}>
          <span /><span /><span />
          <p>getmenuman.com/r/armandos</p>
        </div>
        <div className={styles.browserSite}>
          <header>
            <strong>ARMANDO&apos;S</strong>
            <span>Menu&nbsp;&nbsp;&nbsp; Visit&nbsp;&nbsp;&nbsp; Order</span>
          </header>
          {mode === "menu" ? (
            <div className={styles.demoMenu}>
              <div className={styles.demoMenuControls}>
                <b>Explore the menu</b>
                <span>Search the menu...</span>
              </div>
              <div className={styles.demoCategories}><b>Full Menu</b><span>Breakfast</span><span>Lunch</span><span>Dinner</span></div>
              <div className={styles.demoDishes}>
                <span><i />House Omelette <b>$14</b></span>
                <span><i />Chicken Tostada <b>$16</b></span>
                <span><i />Chile Verde <b>$18</b></span>
                <span><i />Street Tacos <b>$15</b></span>
              </div>
            </div>
          ) : mode === "order" ? (
            <div className={styles.demoOrder}>
              <div><small>YOUR ORDER</small><h3>Pickup made clear.</h3><p>Choose an item, make it yours, and keep the next step obvious.</p></div>
              <aside><span>Chicken Tostada</span><span>2 &times; $16</span><hr /><b>Continue to order &rarr;</b></aside>
            </div>
          ) : mode === "details" ? (
            <div className={styles.demoDetails}>
              <div><small>VISIT ARMANDO&apos;S</small><h3>Hours and location, without the hunt.</h3></div>
              <div className={styles.demoDetailCards}><span><small>OPEN TODAY</small><b>11 AM - 9 PM</b></span><span><small>FIND US</small><b>Santa Rosa, CA</b></span><span><small>CALL</small><b>(707) 555-0142</b></span></div>
            </div>
          ) : (
            <div className={styles.demoHome}>
              <p>FAMILY RECIPES &middot; MADE FRESH</p>
              <h3>Good food.<br />Made together.</h3>
              <span>EXPLORE THE MENU &rarr;</span>
            </div>
          )}
        </div>
      </div>
      <div className={styles.phoneDevice}>
        <div className={styles.phoneNotch} />
        <div className={styles.phoneBar}><b>A</b><span>MENU</span></div>
        <div className={styles.phoneBody}>
          <small>{mode === "menu" ? "SEARCH THE MENU" : mode === "details" ? "VISIT US" : "WELCOME TO"}</small>
          <strong>{mode === "menu" ? "chicken" : mode === "details" ? "Open until 9" : "Armando's"}</strong>
          <span>{mode === "order" ? "ORDER PICKUP" : mode === "details" ? "GET DIRECTIONS" : "VIEW MENU"}</span>
        </div>
        <div className={styles.phoneCard}>
          <small>{mode === "menu" ? "4 RESULTS" : "POPULAR"}</small>
          <b>{mode === "menu" ? "Chicken Tostada" : "House Favorite"}</b>
          <p>Made fresh to order</p>
        </div>
      </div>
    </div>
  );
}
