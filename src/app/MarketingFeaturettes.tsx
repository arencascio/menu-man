"use client";

import Image from "next/image";
import { useId, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { productFeatures } from "./marketing-content";
import MarketingIcon, { type MarketingIconName } from "./MarketingIcon";
import styles from "./marketing-featurettes.module.css";

const visuals = [
  { src: "mobile.webp", width: 700, height: 1390, alt: "Super Tacos restaurant homepage on a small screen" },
  { src: "search.webp", width: 700, height: 770, alt: "A real menu search for menudo with one matching result" },
  { src: "ordering.webp", width: 660, height: 290, alt: "Order Pickup and Order Delivery actions on the Super Tacos homepage" },
  { src: "information.webp", width: 660, height: 1030, alt: "Weekly hours and the fictional address link on Super Tacos" },
] as const;
const icons: MarketingIconName[] = ["phone", "menu", "cart", "map"];
const desktopQuery = "(min-width: 821px)";
const subscribeDesktop = (notify: () => void) => {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const getDesktop = () => window.matchMedia(desktopQuery).matches;
const getServerDesktop = () => false;

/** Stable media slot for a future explicit-play player. No video is configured here.
 * Future players must keep this poster by default and defer all sources until Play. */
function FeaturetteMedia({ index, children }: { index: number; children?: ReactNode }) {
  const media = visuals[index];
  return <figure className={styles.media} data-feature-media={productFeatures[index].id}>
    {children ?? <Image src={`/brand/previews/featurettes/${media.src}`} alt={media.alt} width={media.width} height={media.height} sizes="(max-width: 820px) 90vw, 48vw" />}
  </figure>;
}

/** Four shared featurettes; useId/state keep every Home/Work instance independent. */
export default function MarketingFeaturettes() {
  const [selection, setActive] = useState<number | null>(null);
  const desktop = useSyncExternalStore(subscribeDesktop, getDesktop, getServerDesktop);
  const active = desktop ? selection ?? 0 : selection;
  const id = useId();
  return <div className={styles.featurettes} data-featurettes data-default={selection === null} role="region" aria-label="Restaurant website features">
    {productFeatures.map((feature, index) => <div className={styles.row} key={feature.id} style={{ "--feature-row": index + 1 } as CSSProperties} data-active={active === index}>
      <h3 className={styles.heading}>
        <button className={styles.selector} type="button" id={`${id}-${feature.id}-button`} aria-expanded={active === index} aria-controls={`${id}-${feature.id}-panel`}
          onClick={() => setActive((current) => current === index && window.matchMedia("(max-width: 820px)").matches ? null : index)}
          onKeyDown={(event) => {
            const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
            if (!direction && event.key !== "Home" && event.key !== "End") return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? productFeatures.length - 1 : (index + direction + productFeatures.length) % productFeatures.length;
            setActive(next);
            document.getElementById(`${id}-${productFeatures[next].id}-button`)?.focus();
          }}>
          <MarketingIcon name={icons[index]} size={24} /><span>{feature.title}</span><MarketingIcon name="chevron" size={17} className={styles.chevron} />
        </button>
      </h3>
      <div className={styles.panel} id={`${id}-${feature.id}-panel`} role="region" aria-labelledby={`${id}-${feature.id}-button`} data-open={active === index} aria-hidden={active !== index} inert={active !== index || undefined}>
        <div className={styles.panelInner}><p>{feature.copy}</p><FeaturetteMedia index={index} /></div>
      </div>
    </div>)}
  </div>;
}
