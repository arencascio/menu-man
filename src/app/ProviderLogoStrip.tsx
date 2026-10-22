"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";

const providers: { name: string; src: string; width: number; height: number; featured?: boolean }[] = [
  { name: "Square", src: "/img/providers/Square_Logo_2025_Black-fullmark.svg", width: 2000, height: 501, featured: true },
  { name: "Clover", src: "/img/providers/Clover_idscfTrYLO_0-fullmark.svg", width: 88, height: 22 },
  { name: "Toast", src: "/img/providers/toast-fullmark-logo_color.svg", width: 492, height: 127 },
  { name: "DoorDash", src: "/img/providers/DoorDash_idkbRlvChI_0-fullmark-red.svg", width: 628, height: 75 },
  { name: "Uber Eats", src: "/img/providers/Uber_Eats_fullmark-dualcolor_1.svg", width: 1052, height: 170 },
  { name: "Grubhub", src: "/img/providers/Grubhub_idAwNcLQdh_2-fullmark.svg", width: 594, height: 125 },
];

export default function ProviderLogoStrip() {
  const [failed, setFailed] = useState<string[]>([]);

  return <>
    {providers.map(({ name, src, width, height, featured = false }) => {
      const hasFailed = failed.includes(name);
      return (
        <li key={name} data-featured={featured} data-logo-failed={hasFailed || undefined} role="img" aria-label={name}>
          {!hasFailed && (
            <Image
              className={styles.providerLogo}
              src={src}
              alt=""
              aria-hidden="true"
              width={width}
              height={height}
              onError={() => setFailed((current) => [...current, name])}
            />
          )}
          {hasFailed && <span className={styles.providerFallback} aria-hidden="true">{name}</span>}
        </li>
      );
    })}
  </>;
}
